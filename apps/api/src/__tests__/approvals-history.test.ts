import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'
import { UserRole } from '@hr-system/types'

// Regression guard for the attendance-adjustment history extension to
// GET /approvals/history: a reviewed adjustment request must show up in the
// unified timeline alongside leave and late-excuse history, scoped the same
// way (admins see everything in office, others see only what they reviewed).

const ADJUSTMENT_RECORD = {
  id: 'att-adj-1',
  date: new Date('2026-07-01'),
  adjustmentStatus: 'APPROVED',
  adjustmentReviewedAt: new Date('2026-07-02'),
  adjustmentReviewedBy: 'emp-reviewer',
  adjustmentReason: 'Forgot to check out',
  requestedCheckIn: null,
  requestedCheckOut: new Date('2026-07-01T18:00:00.000Z'),
  employee: { id: 'emp-owner', firstName: 'Ann', lastName: 'Applicant', employeeId: 'BD-2026-002', department: { id: 'dept-1', name: 'IT' } },
}

vi.mock('../config/prisma', () => ({
  prisma: {
    leaveApprovalHistory: { findMany: vi.fn(async () => []) },
    attendance: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        'adjustmentReviewedAt' in where ? [ADJUSTMENT_RECORD] : []
      ),
    },
    employee: {
      findMany: vi.fn(async () => [{ id: 'emp-reviewer', firstName: 'Riya', lastName: 'Reviewer', jobTitle: null }]),
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

function tokenFor(role: UserRole) {
  return signAccessToken({
    id: 'user-1',
    employeeId: 'emp-reviewer',
    email: 'reviewer@test.com',
    role,
    officeId: 'office-bd',
    officeCode: 'BD',
    officeWorkStartTime: '13:30',
    officeWorkEndTime: '22:00',
    firstName: 'Riya',
    lastName: 'Reviewer',
    theme: 'light',
  })
}

describe('GET /approvals/history — attendance adjustments', () => {
  it('includes a reviewed adjustment request in the unified timeline', async () => {
    const token = tokenFor(UserRole.HR_MANAGER)
    const res = await request(app)
      .get('/api/v1/approvals/history?month=7&year=2026')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    const item = res.body.data.find((i: { type: string }) => i.type === 'ADJUSTMENT')
    expect(item).toBeDefined()
    expect(item.action).toBe('APPROVED')
    expect(item.employee.id).toBe('emp-owner')
  })
})
