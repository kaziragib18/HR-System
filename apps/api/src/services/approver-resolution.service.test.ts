import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@hr-system/types'

const EMPLOYEES: Record<string, { reportingToId: string | null; departmentId: string }> = {
  'emp-1': { reportingToId: 'emp-manager', departmentId: 'dept-1' },
  'emp-no-manager': { reportingToId: null, departmentId: 'dept-1' },
}

const DEPARTMENTS: Record<string, { managerId: string | null; code?: string; officeId?: string }> = {
  'dept-1': { managerId: 'emp-depthead' },
}

vi.mock('../config/prisma', () => ({
  prisma: {
    employee: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => EMPLOYEES[where.id] ?? null),
    },
    department: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => DEPARTMENTS[where.id] ?? null),
      findFirst: vi.fn(async () => ({ managerId: 'emp-hr-depthead' })),
    },
    user: {
      findFirst: vi.fn(async () => ({ employeeId: 'emp-hr-manager' })),
    },
  },
}))

import { resolveApproverForRole, resolveHrDeptHeadApprover, resolveTeamApprover, canActOnTeamRequest } from './approver-resolution.service'
import { prisma } from '../config/prisma'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveApproverForRole', () => {
  it("resolves DEPT_MANAGER level to the employee's direct manager", async () => {
    const result = await resolveApproverForRole(prisma as never, UserRole.DEPT_MANAGER, 'emp-1', 'office-bd')
    expect(result).toBe('emp-manager')
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
    const result = await resolveApproverForRole(prisma as never, UserRole.DEPT_MANAGER, 'emp-no-manager', 'office-bd')
    expect(result).toBeNull()
  })
})

describe('resolveHrDeptHeadApprover', () => {
  it('resolves to the HR department manager', async () => {
    const result = await resolveHrDeptHeadApprover(prisma as never, 'office-bd')
    expect(result).toBe('emp-hr-depthead')
  })
})

describe('resolveTeamApprover', () => {
  it('routes an EMPLOYEE requester to their DEPT_MANAGER', async () => {
    const result = await resolveTeamApprover(prisma as never, 'emp-1', UserRole.EMPLOYEE, 'office-bd')
    expect(result).toBe('emp-manager')
  })

  it('falls back to DEPT_HEAD when the requester has no direct manager', async () => {
    const result = await resolveTeamApprover(prisma as never, 'emp-no-manager', UserRole.EMPLOYEE, 'office-bd')
    expect(result).toBe('emp-depthead')
  })

  it("escalates a DEPT_HEAD requester's own request to the HR department head", async () => {
    const result = await resolveTeamApprover(prisma as never, 'emp-1', UserRole.DEPT_HEAD, 'office-bd')
    expect(result).toBe('emp-hr-depthead')
  })

  it("escalates an HR_MANAGER requester's own request to the HR department head", async () => {
    const result = await resolveTeamApprover(prisma as never, 'emp-1', UserRole.HR_MANAGER, 'office-bd')
    expect(result).toBe('emp-hr-depthead')
  })
})

describe('canActOnTeamRequest', () => {
  it('always allows SUPER_ADMIN', async () => {
    const result = await canActOnTeamRequest(prisma as never, 'anyone', UserRole.SUPER_ADMIN, 'emp-manager', 'dept-1')
    expect(result).toBe(true)
  })

  it('allows the specific resolved approver', async () => {
    const result = await canActOnTeamRequest(prisma as never, 'emp-manager', UserRole.DEPT_MANAGER, 'emp-manager', 'dept-1')
    expect(result).toBe(true)
  })

  it("allows the requester's department head even if not the resolved approver (override)", async () => {
    const result = await canActOnTeamRequest(prisma as never, 'emp-depthead', UserRole.DEPT_HEAD, 'emp-manager', 'dept-1')
    expect(result).toBe(true)
  })

  it('rejects HR_MANAGER acting without a matching resolved approver or department headship', async () => {
    const result = await canActOnTeamRequest(prisma as never, 'emp-hr-manager', UserRole.HR_MANAGER, 'emp-manager', 'dept-1')
    expect(result).toBe(false)
  })

  it('rejects an unrelated DEPT_MANAGER', async () => {
    const result = await canActOnTeamRequest(prisma as never, 'emp-other-manager', UserRole.DEPT_MANAGER, 'emp-manager', 'dept-1')
    expect(result).toBe(false)
  })
})
