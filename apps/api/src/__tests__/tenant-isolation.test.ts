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

const EMPLOYEES: Record<string, { officeId: string }> = {
  'emp-bd': { officeId: 'office-bd' },
  'emp-uk': { officeId: 'office-uk' },
}

vi.mock('../config/prisma', () => ({
  prisma: {
    leaveApplication: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => LEAVE_APPLICATIONS[where.id] ?? null),
    },
    employee: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => EMPLOYEES[where.id] ?? null),
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

function tokenFor(overrides: { role: UserRole; officeId: string }) {
  return signAccessToken({
    id: `user-${overrides.officeId}`,
    employeeId: `emp-owner-${overrides.officeId === 'office-bd' ? 'bd' : 'uk'}`,
    email: `${overrides.role.toLowerCase()}@test.com`,
    role: overrides.role,
    officeId: overrides.officeId,
    officeCode: overrides.officeId === 'office-bd' ? 'BD' : 'UK',
    firstName: 'Test',
    lastName: 'User',
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
