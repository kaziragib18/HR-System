import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@hr-system/types'

const USERS: Record<string, { role: string; isActive: boolean; employeeId: string }> = {
  'emp-super': { role: 'SUPER_ADMIN', isActive: true, employeeId: 'emp-super' },
  'emp-super-2': { role: 'SUPER_ADMIN', isActive: true, employeeId: 'emp-super-2' },
  'emp-hr': { role: 'HR_MANAGER', isActive: true, employeeId: 'emp-hr' },
  'emp-depthead-acc': { role: 'DEPT_HEAD', isActive: true, employeeId: 'emp-depthead-acc' },
  'emp-manager-acc': { role: 'DEPT_MANAGER', isActive: true, employeeId: 'emp-manager-acc' },
}

const EMPLOYEES: Record<string, { departmentId: string }> = {
  'emp-super': { departmentId: 'dept-admin' },
  'emp-super-2': { departmentId: 'dept-admin' },
  'emp-hr': { departmentId: 'dept-hr' },
  'emp-depthead-acc': { departmentId: 'dept-acc' },
  'emp-manager-acc': { departmentId: 'dept-acc' },
  'emp-ghost': undefined as never,
}

vi.mock('../../config/prisma', () => ({
  prisma: {
    employee: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => EMPLOYEES[where.id] ?? null),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { employeeId: string } }) => USERS[where.employeeId] ?? null),
      count: vi.fn(async ({ where }: { where: { role: string; isActive: boolean; employeeId: { not: string } } }) =>
        Object.entries(USERS).filter(
          ([id, u]) => u.role === where.role && u.isActive === where.isActive && id !== where.employeeId.not
        ).length
      ),
      findFirst: vi.fn(async ({ where }: { where: { role: string; isActive: boolean; employeeId: { not: string }; employee: { departmentId: string } } }) => {
        const match = Object.entries(USERS).find(([id, u]) => {
          if (u.role !== where.role || u.isActive !== where.isActive || id === where.employeeId.not) return false
          const emp = EMPLOYEES[id]
          return emp?.departmentId === where.employee.departmentId
        })
        return match ? { employeeId: match[0] } : null
      }),
      update: vi.fn(async ({ where, data }: { where: { employeeId: string }; data: { role: string } }) => ({
        employeeId: where.employeeId,
        role: data.role,
      })),
    },
  },
}))

import { updateEmployeeRole } from './employees.service'
import { prisma } from '../../config/prisma'

const userUpdate = prisma.user.update as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  userUpdate.mockImplementation(async ({ where, data }: { where: { employeeId: string }; data: { role: string } }) => ({
    employeeId: where.employeeId,
    role: data.role,
  }))
})

describe('updateEmployeeRole', () => {
  it('updates the role for a normal case', async () => {
    const result = await updateEmployeeRole('emp-hr', UserRole.EMPLOYEE, 'emp-super')
    expect(result.role).toBe(UserRole.EMPLOYEE)
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: 'emp-hr' }, data: { role: UserRole.EMPLOYEE } })
    )
  })

  it('never selects passwordHash or twoFactorSecret back in the response', async () => {
    await updateEmployeeRole('emp-hr', UserRole.EMPLOYEE, 'emp-super')
    const call = userUpdate.mock.calls[0][0] as { select?: Record<string, unknown> }
    expect(call.select).toBeDefined()
    expect(call.select).not.toHaveProperty('passwordHash')
    expect(call.select).not.toHaveProperty('twoFactorSecret')
  })

  it('rejects an admin changing their own role', async () => {
    await expect(updateEmployeeRole('emp-super', UserRole.HR_MANAGER, 'emp-super')).rejects.toThrow(
      'You cannot change your own role'
    )
  })

  it('rejects demoting the last active Super Admin', async () => {
    const backup = USERS['emp-super-2']
    delete USERS['emp-super-2']
    try {
      await expect(updateEmployeeRole('emp-super', UserRole.HR_MANAGER, 'emp-hr')).rejects.toThrow(
        'Cannot remove the last Super Admin'
      )
    } finally {
      USERS['emp-super-2'] = backup
    }
  })

  it('allows demoting one of two active Super Admins', async () => {
    const result = await updateEmployeeRole('emp-super', UserRole.HR_MANAGER, 'emp-hr')
    expect(result.role).toBe(UserRole.HR_MANAGER)
  })

  it('throws 404 when the target employee has no user record', async () => {
    await expect(updateEmployeeRole('emp-ghost', UserRole.EMPLOYEE, 'emp-super')).rejects.toThrow(
      'Employee not found'
    )
  })

  it('reports the correct HTTP status on each error', async () => {
    await expect(updateEmployeeRole('emp-super', UserRole.HR_MANAGER, 'emp-super')).rejects.toMatchObject({
      status: 400,
    })
    await expect(updateEmployeeRole('emp-ghost', UserRole.EMPLOYEE, 'emp-super')).rejects.toMatchObject({
      status: 404,
    })
  })

  it('rejects promoting a second DEPT_HEAD into a department that already has one', async () => {
    await expect(updateEmployeeRole('emp-manager-acc', UserRole.DEPT_HEAD, 'emp-super')).rejects.toThrow(
      'This department already has a department head'
    )
  })

  it('allows promoting to DEPT_HEAD when the department has no existing head', async () => {
    const result = await updateEmployeeRole('emp-hr', UserRole.DEPT_HEAD, 'emp-super')
    expect(result.role).toBe(UserRole.DEPT_HEAD)
  })

  it('allows re-affirming the existing DEPT_HEAD of their own department (excludes self from the conflict check)', async () => {
    const result = await updateEmployeeRole('emp-depthead-acc', UserRole.DEPT_HEAD, 'emp-super')
    expect(result.role).toBe(UserRole.DEPT_HEAD)
  })
})
