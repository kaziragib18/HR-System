import { describe, it, expect, vi, beforeEach } from 'vitest'

// Regression guard: DEPT_HEAD/DEPT_MANAGER must only ever see attendance for
// their own department on Time Management, regardless of what departmentId
// (or employeeId) a client sends — see department.middleware.ts's
// departmentScope, wired into GET /attendance.

vi.mock('../../config/prisma', () => ({
  prisma: {
    attendance: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
  },
}))

import { listAttendance } from './attendance.service'
import { prisma } from '../../config/prisma'

const findMany = prisma.attendance.findMany as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  findMany.mockResolvedValue([])
})

describe('listAttendance department scoping', () => {
  it('forces departmentScope into the employee filter, ignoring a mismatched query.departmentId', async () => {
    await listAttendance('office-bd', 'dept-own', { departmentId: 'dept-other', page: 1, limit: 20 } as any)
    const { where } = findMany.mock.calls[0][0]
    expect(where.employee).toMatchObject({ officeId: 'office-bd', departmentId: 'dept-own' })
  })

  it('still applies departmentScope even when the client also passes an employeeId', async () => {
    await listAttendance('office-bd', 'dept-own', { employeeId: 'emp-outside', page: 1, limit: 20 } as any)
    const { where } = findMany.mock.calls[0][0]
    expect(where.employeeId).toBe('emp-outside')
    expect(where.employee).toMatchObject({ departmentId: 'dept-own' })
    // The AND of employeeId + employee.departmentId means an employee outside
    // dept-own simply matches nothing — enforced by Prisma, not this test,
    // but the shape of the query must combine both constraints.
  })

  it('leaves query.departmentId untouched when no departmentScope applies (SUPER_ADMIN/HR_MANAGER)', async () => {
    await listAttendance('office-bd', undefined, { departmentId: 'dept-any', page: 1, limit: 20 } as any)
    const { where } = findMany.mock.calls[0][0]
    expect(where.employee).toMatchObject({ officeId: 'office-bd', departmentId: 'dept-any' })
  })

  it('has no department filter at all when neither departmentScope nor query.departmentId is set', async () => {
    await listAttendance('office-bd', undefined, { page: 1, limit: 20 } as any)
    const { where } = findMany.mock.calls[0][0]
    expect(where.employee).not.toHaveProperty('departmentId')
  })
})
