import { describe, it, expect, vi } from 'vitest'
import { UserRole } from '@hr-system/types'

const EMPLOYEES: Record<string, { reportingToId: string | null; departmentId: string }> = {
  'emp-1': { reportingToId: 'emp-teamlead', departmentId: 'dept-1' },
  'emp-no-manager': { reportingToId: null, departmentId: 'dept-1' },
}

const DEPARTMENTS: Record<string, { managerId: string | null }> = {
  'dept-1': { managerId: 'emp-depthead' },
}

vi.mock('../config/prisma', () => ({
  prisma: {
    employee: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => EMPLOYEES[where.id] ?? null),
    },
    department: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => DEPARTMENTS[where.id] ?? null),
    },
    user: {
      findFirst: vi.fn(async () => ({ employeeId: 'emp-hr-manager' })),
    },
  },
}))

import { resolveApproverForRole } from './approver-resolution.service'
import { prisma } from '../config/prisma'

describe('resolveApproverForRole', () => {
  it("resolves TEAM_LEAD level to the employee's direct manager", async () => {
    const result = await resolveApproverForRole(prisma as never, UserRole.TEAM_LEAD, 'emp-1', 'office-bd')
    expect(result).toBe('emp-teamlead')
  })

  it("resolves DEPT_HEAD level to the employee's department manager", async () => {
    const result = await resolveApproverForRole(prisma as never, UserRole.DEPT_HEAD, 'emp-1', 'office-bd')
    expect(result).toBe('emp-depthead')
  })

  it('resolves HR_MANAGER level to any user with that role in the office (unchanged behavior)', async () => {
    const result = await resolveApproverForRole(prisma as never, UserRole.HR_MANAGER, 'emp-1', 'office-bd')
    expect(result).toBe('emp-hr-manager')
  })

  it('returns null when the employee has no direct manager assigned', async () => {
    const result = await resolveApproverForRole(prisma as never, UserRole.TEAM_LEAD, 'emp-no-manager', 'office-bd')
    expect(result).toBeNull()
  })
})
