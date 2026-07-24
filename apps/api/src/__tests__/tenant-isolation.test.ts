import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'
import { UserRole } from '@hr-system/types'

// Regression guard for the Milestone 1 tenant-isolation fixes: an HR_MANAGER
// (or lower) scoped to one office must not be able to read a single resource
// that belongs to a different office by ID, while a SUPER_ADMIN (unscoped)
// still can. The Prisma client is mocked so this runs without a database.

const LEAVE_APPLICATIONS: Record<string, unknown> = {
  'app-bd': {
    id: 'app-bd',
    employeeId: 'emp-owner-bd',
    employee: { id: 'emp-owner-bd', firstName: 'Bashir', lastName: 'Rahman', employeeId: 'BD-2026-001', officeId: 'office-bd' },
    leaveType: { id: 'lt-1', name: 'Annual Leave', code: 'AL' },
    approvalHistory: [],
  },
  'app-uk': {
    id: 'app-uk',
    employeeId: 'emp-owner-uk',
    employee: { id: 'emp-owner-uk', firstName: 'James', lastName: 'Smith', employeeId: 'UK-2026-001', officeId: 'office-uk' },
    leaveType: { id: 'lt-2', name: 'Annual Leave', code: 'AL' },
    approvalHistory: [],
  },
}

interface MockEmployee {
  officeId: string
  departmentId?: string | null
  reportingToId?: string | null
}

const EMPLOYEES: Record<string, MockEmployee> = {
  'emp-bd': { officeId: 'office-bd' },
  'emp-uk': { officeId: 'office-uk' },
  // Team-scoped salary access fixture: mgr-bd manages report-bd directly;
  // peer-bd is in the same department but reports to someone else (only a
  // DEPT_HEAD, not mgr-bd, should be able to see peer-bd's salary);
  // outside-bd is in a different department entirely.
  'mgr-bd': { officeId: 'office-bd', departmentId: 'dept-a', reportingToId: null },
  'report-bd': { officeId: 'office-bd', departmentId: 'dept-a', reportingToId: 'mgr-bd' },
  'peer-bd': { officeId: 'office-bd', departmentId: 'dept-a', reportingToId: 'other-mgr-bd' },
  'outside-bd': { officeId: 'office-bd', departmentId: 'dept-b', reportingToId: null },
}

vi.mock('../config/prisma', () => ({
  prisma: {
    leaveApplication: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => LEAVE_APPLICATIONS[where.id] ?? null),
    },
    employee: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => EMPLOYEES[where.id] ?? null),
    },
    salaryStructure: {
      // Any authorized read reaches here — return a minimal, always-truthy
      // structure so the response is a 200, not a 404 "no structure found".
      findFirst: vi.fn(async () => ({
        id: 'ss-1', employeeId: null, jobGradeId: null, basicSalary: '50000', components: [],
        effectiveFrom: new Date('2020-01-01'), effectiveTo: null,
      })),
    },
  },
}))

let app: import('express').Express
let signAccessToken: typeof import('../utils/jwt').signAccessToken

beforeAll(async () => {
  const { createApp } = await import('../app')
  ;({ signAccessToken } = await import('../utils/jwt'))
  app = createApp()
})

function tokenFor(overrides: { role: UserRole; officeId: string; employeeId?: string; departmentId?: string | null }) {
  const officeCode = overrides.officeId === 'office-bd' ? 'BD' : 'UK'
  return signAccessToken({
    id: `user-${overrides.employeeId ?? overrides.officeId}`,
    employeeId: overrides.employeeId ?? `emp-owner-${officeCode === 'BD' ? 'bd' : 'uk'}`,
    email: `${overrides.role.toLowerCase()}@test.com`,
    role: overrides.role,
    officeId: overrides.officeId,
    officeCode,
    officeWorkStartTime: '09:00',
    officeWorkEndTime: '17:00',
    firstName: 'Test',
    lastName: 'User',
    theme: 'light',
    departmentId: overrides.departmentId,
  })
}

describe('tenant isolation — leave applications', () => {
  it('blocks an HR_MANAGER from reading an application in another office', async () => {
    const token = tokenFor({ role: UserRole.HR_MANAGER, officeId: 'office-bd' })
    const res = await request(app)
      .get('/api/v1/leave/applications/app-uk')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('allows an HR_MANAGER to read an application in their own office', async () => {
    const token = tokenFor({ role: UserRole.HR_MANAGER, officeId: 'office-bd' })
    const res = await request(app)
      .get('/api/v1/leave/applications/app-bd')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('app-bd')
  })

  it('allows a SUPER_ADMIN to read an application in any office', async () => {
    const token = tokenFor({ role: UserRole.SUPER_ADMIN, officeId: 'office-bd' })
    const res = await request(app)
      .get('/api/v1/leave/applications/app-uk')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('app-uk')
  })
})

describe('tenant isolation — salary', () => {
  it('blocks an HR_MANAGER from reading salary for an employee in another office', async () => {
    const token = tokenFor({ role: UserRole.HR_MANAGER, officeId: 'office-bd' })
    const res = await request(app)
      .get('/api/v1/salary/emp-uk')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })
})

// Regression guard for the salary-IDOR fix: a DEPT_MANAGER/DEPT_HEAD must only
// see salary within their own team (direct reports / own department), not
// anyone office-wide — see salary.controller.ts's getForEmployee.
describe('team-scoped salary access', () => {
  it('always allows an employee to read their own salary', async () => {
    const token = tokenFor({ role: UserRole.DEPT_MANAGER, officeId: 'office-bd', employeeId: 'mgr-bd', departmentId: 'dept-a' })
    const res = await request(app)
      .get('/api/v1/salary/mgr-bd')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('allows a DEPT_MANAGER to read a direct report\'s salary', async () => {
    const token = tokenFor({ role: UserRole.DEPT_MANAGER, officeId: 'office-bd', employeeId: 'mgr-bd', departmentId: 'dept-a' })
    const res = await request(app)
      .get('/api/v1/salary/report-bd')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('blocks a DEPT_MANAGER from reading a same-department peer who is not their direct report', async () => {
    const token = tokenFor({ role: UserRole.DEPT_MANAGER, officeId: 'office-bd', employeeId: 'mgr-bd', departmentId: 'dept-a' })
    const res = await request(app)
      .get('/api/v1/salary/peer-bd')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('blocks a DEPT_MANAGER from reading salary outside their department entirely', async () => {
    const token = tokenFor({ role: UserRole.DEPT_MANAGER, officeId: 'office-bd', employeeId: 'mgr-bd', departmentId: 'dept-a' })
    const res = await request(app)
      .get('/api/v1/salary/outside-bd')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('allows a DEPT_HEAD to read salary for anyone in their own department, even a non-direct-report', async () => {
    const token = tokenFor({ role: UserRole.DEPT_HEAD, officeId: 'office-bd', employeeId: 'head-bd', departmentId: 'dept-a' })
    const res = await request(app)
      .get('/api/v1/salary/peer-bd')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('blocks a DEPT_HEAD from reading salary outside their own department', async () => {
    const token = tokenFor({ role: UserRole.DEPT_HEAD, officeId: 'office-bd', employeeId: 'head-bd', departmentId: 'dept-a' })
    const res = await request(app)
      .get('/api/v1/salary/outside-bd')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('still allows HR_MANAGER to read anyone\'s salary within their office', async () => {
    const token = tokenFor({ role: UserRole.HR_MANAGER, officeId: 'office-bd' })
    const res = await request(app)
      .get('/api/v1/salary/outside-bd')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('blocks a plain EMPLOYEE from reading anyone else\'s salary', async () => {
    const token = tokenFor({ role: UserRole.EMPLOYEE, officeId: 'office-bd', employeeId: 'report-bd', departmentId: 'dept-a' })
    const res = await request(app)
      .get('/api/v1/salary/peer-bd')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})
