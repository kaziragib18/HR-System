import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@hr-system/types'

const USERS: Record<string, { role: string; isActive: boolean }> = {
  'emp-super': { role: 'SUPER_ADMIN', isActive: true },
  'emp-super-2': { role: 'SUPER_ADMIN', isActive: true },
  'emp-hr': { role: 'HR_MANAGER', isActive: true },
}

vi.mock('../../config/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { employeeId: string } }) => USERS[where.employeeId] ?? null),
      count: vi.fn(async ({ where }: { where: { role: string; isActive: boolean; employeeId: { not: string } } }) =>
        Object.entries(USERS).filter(
          ([id, u]) => u.role === where.role && u.isActive === where.isActive && id !== where.employeeId.not
        ).length
      ),
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
    const result = await updateEmployeeRole('emp-hr', UserRole.DEPT_HEAD, 'emp-super')
    expect(result.role).toBe(UserRole.DEPT_HEAD)
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeId: 'emp-hr' }, data: { role: UserRole.DEPT_HEAD } })
    )
  })

  it('never selects passwordHash or twoFactorSecret back in the response', async () => {
    await updateEmployeeRole('emp-hr', UserRole.DEPT_HEAD, 'emp-super')
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
})
