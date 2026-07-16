import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@hr-system/types'

const txUserUpdate = vi.fn(async () => ({}))
const txDepartmentUpdate = vi.fn(async () => ({}))
const txDepartmentFindUnique = vi.fn(async (): Promise<{ id: string; managerId: string | null }> => ({ id: 'dept-1', managerId: null }))

vi.mock('../../config/prisma', () => ({
  prisma: {
    department: {
      findUnique: vi.fn(async () => ({ id: 'dept-1', officeId: 'office-bd', managerId: 'emp-head' })),
    },
    employee: {
      findUnique: vi.fn(async () => ({ id: 'emp-x', departmentId: 'dept-1', officeId: 'office-bd', user: { role: 'EMPLOYEE' } })),
    },
    user: {
      findFirst: vi.fn(async () => null),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        user: { update: txUserUpdate },
        department: { update: txDepartmentUpdate, findUnique: txDepartmentFindUnique },
      })
    ),
  },
}))

import { appointDeptRole, dismissDeptRole } from './departments.service'
import { prisma } from '../../config/prisma'

const departmentFindUnique = prisma.department.findUnique as ReturnType<typeof vi.fn>
const employeeFindUnique = prisma.employee.findUnique as ReturnType<typeof vi.fn>
const userFindFirst = prisma.user.findFirst as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  departmentFindUnique.mockResolvedValue({ id: 'dept-1', officeId: 'office-bd', managerId: 'emp-head' })
  employeeFindUnique.mockResolvedValue({ id: 'emp-x', departmentId: 'dept-1', officeId: 'office-bd', user: { role: 'EMPLOYEE' } })
  userFindFirst.mockResolvedValue(null)
  txDepartmentFindUnique.mockResolvedValue({ id: 'dept-1', managerId: null })
})

describe('appointDeptRole', () => {
  it('appointing a DEPT_HEAD switches the role AND syncs Department.managerId', async () => {
    await appointDeptRole('dept-1', 'office-bd', 'emp-x', UserRole.DEPT_HEAD)
    expect(txUserUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { employeeId: 'emp-x' }, data: { role: UserRole.DEPT_HEAD } }))
    expect(txDepartmentUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'dept-1' }, data: { managerId: 'emp-x' } }))
  })

  it('appointing a DEPT_MANAGER switches the role but does NOT touch managerId', async () => {
    await appointDeptRole('dept-1', 'office-bd', 'emp-x', UserRole.DEPT_MANAGER)
    expect(txUserUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { role: UserRole.DEPT_MANAGER } }))
    expect(txDepartmentUpdate).not.toHaveBeenCalled()
  })

  it('rejects appointing someone from a different department', async () => {
    employeeFindUnique.mockResolvedValue({ id: 'emp-x', departmentId: 'dept-OTHER', officeId: 'office-bd', user: { role: 'EMPLOYEE' } })
    await expect(appointDeptRole('dept-1', 'office-bd', 'emp-x', UserRole.DEPT_MANAGER)).rejects.toMatchObject({ status: 400 })
    expect(txUserUpdate).not.toHaveBeenCalled()
  })

  it('rejects when the department already has that role holder (one head / one manager)', async () => {
    userFindFirst.mockResolvedValue({ employeeId: 'emp-existing' })
    await expect(appointDeptRole('dept-1', 'office-bd', 'emp-x', UserRole.DEPT_HEAD)).rejects.toMatchObject({ status: 400 })
    expect(txUserUpdate).not.toHaveBeenCalled()
  })

  it('rejects re-roling an admin (HR_MANAGER / SUPER_ADMIN) from the department card', async () => {
    employeeFindUnique.mockResolvedValue({ id: 'emp-x', departmentId: 'dept-1', officeId: 'office-bd', user: { role: 'HR_MANAGER' } })
    await expect(appointDeptRole('dept-1', 'office-bd', 'emp-x', UserRole.DEPT_HEAD)).rejects.toMatchObject({ status: 400 })
  })

  it('rejects a target employee in another office', async () => {
    employeeFindUnique.mockResolvedValue({ id: 'emp-x', departmentId: 'dept-1', officeId: 'office-uk', user: { role: 'EMPLOYEE' } })
    await expect(appointDeptRole('dept-1', 'office-bd', 'emp-x', UserRole.DEPT_MANAGER)).rejects.toMatchObject({ status: 404 })
  })
})

describe('dismissDeptRole', () => {
  it('resets a manager to EMPLOYEE (managerId untouched — not the head)', async () => {
    employeeFindUnique.mockResolvedValue({ id: 'emp-mgr', departmentId: 'dept-1', officeId: 'office-bd', user: { role: 'DEPT_MANAGER' } })
    txDepartmentFindUnique.mockResolvedValue({ id: 'dept-1', managerId: 'emp-head' }) // head is someone else
    await dismissDeptRole('dept-1', 'office-bd', 'emp-mgr')
    expect(txUserUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { role: UserRole.EMPLOYEE } }))
    expect(txDepartmentUpdate).not.toHaveBeenCalled()
  })

  it('resets the head to EMPLOYEE AND clears Department.managerId', async () => {
    employeeFindUnique.mockResolvedValue({ id: 'emp-head', departmentId: 'dept-1', officeId: 'office-bd', user: { role: 'DEPT_HEAD' } })
    txDepartmentFindUnique.mockResolvedValue({ id: 'dept-1', managerId: 'emp-head' })
    await dismissDeptRole('dept-1', 'office-bd', 'emp-head')
    expect(txUserUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { role: UserRole.EMPLOYEE } }))
    expect(txDepartmentUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'dept-1' }, data: { managerId: null } }))
  })

  it('rejects dismissing a plain employee (not a head/manager)', async () => {
    employeeFindUnique.mockResolvedValue({ id: 'emp-x', departmentId: 'dept-1', officeId: 'office-bd', user: { role: 'EMPLOYEE' } })
    await expect(dismissDeptRole('dept-1', 'office-bd', 'emp-x')).rejects.toMatchObject({ status: 400 })
  })
})
