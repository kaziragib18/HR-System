import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@hr-system/types'

const RECORDS: Record<string, any> = {}

function makeRecord(overrides: Partial<any> = {}) {
  return {
    id: 'att-1',
    employeeId: 'emp-1',
    date: new Date('2020-01-02'),
    checkIn: null,
    checkOut: null,
    status: 'ABSENT',
    lateMinutes: 0,
    earlyDepartureMinutes: 0,
    overtimeMinutes: 0,
    workingMinutes: 0,
    adjustmentStatus: null,
    adjustmentApproverId: null,
    employee: { officeId: 'office-bd', departmentId: 'dept-1' },
    ...overrides,
  }
}

const txAttendanceUpdateMany = vi.fn(async (_args: { where: unknown; data: Record<string, unknown> }) => ({ count: 1 }))

vi.mock('../../config/prisma', () => ({
  prisma: {
    attendance: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async ({ create }: { create: any }) => ({ id: 'att-1', ...create })),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => ({ id: where.id, ...data })),
      findMany: vi.fn(async () => []),
    },
    office: { findUnique: vi.fn(async () => ({ code: 'BD' })) },
    publicHoliday: { count: vi.fn(async () => 0) },
    leaveApplication: { count: vi.fn(async () => 0) },
    user: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ attendance: { updateMany: txAttendanceUpdateMany } })
    ),
  },
}))

vi.mock('../../services/approver-resolution.service', () => ({
  resolveTeamApprover: vi.fn(async () => 'emp-manager'),
  canActOnTeamRequest: vi.fn(async (_db: unknown, reviewerId: string, reviewerRole: string, resolvedApproverId: string | null) =>
    reviewerRole === UserRole.SUPER_ADMIN || resolvedApproverId === reviewerId
  ),
}))

vi.mock('../../services/notification.service', () => ({
  createNotification: vi.fn(async () => {}),
}))

import {
  requestAdjustment,
  updateAdjustmentRequest,
  listPendingAdjustments,
  reviewAdjustment,
} from './attendance.service'
import { prisma } from '../../config/prisma'
import { resolveTeamApprover, canActOnTeamRequest } from '../../services/approver-resolution.service'
import { createNotification } from '../../services/notification.service'

const attendanceFindUnique = prisma.attendance.findUnique as ReturnType<typeof vi.fn>
const attendanceUpsert = prisma.attendance.upsert as ReturnType<typeof vi.fn>
const attendanceUpdate = prisma.attendance.update as ReturnType<typeof vi.fn>
const attendanceFindMany = prisma.attendance.findMany as ReturnType<typeof vi.fn>
const officeFindUnique = prisma.office.findUnique as ReturnType<typeof vi.fn>
const publicHolidayCount = prisma.publicHoliday.count as ReturnType<typeof vi.fn>
const leaveApplicationCount = prisma.leaveApplication.count as ReturnType<typeof vi.fn>
const userFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>

beforeEach(() => {
  Object.keys(RECORDS).forEach((k) => delete RECORDS[k])
  vi.clearAllMocks()
  attendanceFindUnique.mockResolvedValue(null)
  attendanceUpsert.mockImplementation(async ({ create }: { create: any }) => ({ id: 'att-1', ...create }))
  attendanceUpdate.mockImplementation(async ({ where, data }: { where: { id: string }; data: any }) => ({ id: where.id, ...data }))
  officeFindUnique.mockResolvedValue({ code: 'BD' })
  publicHolidayCount.mockResolvedValue(0)
  leaveApplicationCount.mockResolvedValue(0)
  ;(resolveTeamApprover as ReturnType<typeof vi.fn>).mockResolvedValue('emp-manager')
  ;(canActOnTeamRequest as ReturnType<typeof vi.fn>).mockImplementation(
    async (_db: unknown, reviewerId: string, reviewerRole: string, resolvedApproverId: string | null) =>
      reviewerRole === UserRole.SUPER_ADMIN || resolvedApproverId === reviewerId
  )
  txAttendanceUpdateMany.mockResolvedValue({ count: 1 })
  userFindMany.mockResolvedValue([])
})

describe('requestAdjustment', () => {
  it('rejects a date that is today or later', async () => {
    const today = new Date().toISOString().slice(0, 10)
    await expect(
      requestAdjustment('emp-1', 'office-bd', UserRole.EMPLOYEE, { date: today, requestedCheckIn: '2026-01-01T09:00:00.000Z', reason: 'forgot' })
    ).rejects.toThrow('Adjustment requests can only be made for past days')
  })

  it('creates a placeholder record and resolves an approver when no record exists for that day', async () => {
    attendanceFindUnique.mockResolvedValue(null)
    await requestAdjustment('emp-1', 'office-bd', UserRole.EMPLOYEE, {
      date: '2020-01-02',
      requestedCheckIn: '2020-01-02T09:00:00.000Z',
      requestedCheckOut: '2020-01-02T18:00:00.000Z',
      reason: 'Forgot to check in and out',
    })
    expect(attendanceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: 'ABSENT', adjustmentStatus: 'PENDING', adjustmentApproverId: 'emp-manager' }),
      })
    )
    expect(createNotification).toHaveBeenCalledWith(
      'emp-manager',
      'ATTENDANCE_ADJUSTMENT_REQUESTED',
      expect.any(String),
      expect.any(String),
      { attendanceId: 'att-1' }
    )
  })

  it('rejects a new request while one is already pending', async () => {
    attendanceFindUnique.mockResolvedValue(makeRecord({ adjustmentStatus: 'PENDING' }))
    await expect(
      requestAdjustment('emp-1', 'office-bd', UserRole.EMPLOYEE, { date: '2020-01-02', requestedCheckIn: '2020-01-02T09:00:00.000Z', reason: 'forgot' })
    ).rejects.toThrow('An adjustment request is already pending for this record')
  })

  it('notifies every SUPER_ADMIN in the office when no specific approver resolves at all', async () => {
    attendanceFindUnique.mockResolvedValue(null)
    ;(resolveTeamApprover as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    userFindMany.mockResolvedValue([{ employeeId: 'emp-admin-1' }, { employeeId: 'emp-admin-2' }])

    await requestAdjustment('emp-1', 'office-bd', UserRole.EMPLOYEE, {
      date: '2020-01-02',
      requestedCheckIn: '2020-01-02T09:00:00.000Z',
      reason: 'Forgot to check in',
    })

    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employee: { officeId: 'office-bd' }, role: UserRole.SUPER_ADMIN }),
      })
    )
    expect(createNotification).toHaveBeenCalledWith(
      'emp-admin-1', 'ATTENDANCE_ADJUSTMENT_REQUESTED', expect.any(String), expect.any(String), { attendanceId: 'att-1' }
    )
    expect(createNotification).toHaveBeenCalledWith(
      'emp-admin-2', 'ATTENDANCE_ADJUSTMENT_REQUESTED', expect.any(String), expect.any(String), { attendanceId: 'att-1' }
    )
  })
})

describe('updateAdjustmentRequest', () => {
  it('rejects an employee editing someone else\'s request', async () => {
    RECORDS['att-1'] = makeRecord({ employeeId: 'emp-1', adjustmentStatus: 'PENDING' })
    attendanceFindUnique.mockResolvedValue(RECORDS['att-1'])
    await expect(
      updateAdjustmentRequest('att-1', 'emp-2', { date: '2020-01-02', requestedCheckIn: '2020-01-02T09:00:00.000Z', reason: 'forgot' })
    ).rejects.toThrow('You can only edit your own adjustment request')
  })

  it('rejects editing once the request is no longer pending', async () => {
    RECORDS['att-1'] = makeRecord({ employeeId: 'emp-1', adjustmentStatus: 'APPROVED' })
    attendanceFindUnique.mockResolvedValue(RECORDS['att-1'])
    await expect(
      updateAdjustmentRequest('att-1', 'emp-1', { date: '2020-01-02', requestedCheckIn: '2020-01-02T09:00:00.000Z', reason: 'forgot' })
    ).rejects.toThrow('This request is no longer pending')
  })

  it('updates the requested times and reason while pending', async () => {
    RECORDS['att-1'] = makeRecord({ employeeId: 'emp-1', adjustmentStatus: 'PENDING' })
    attendanceFindUnique.mockResolvedValue(RECORDS['att-1'])
    await updateAdjustmentRequest('att-1', 'emp-1', {
      date: '2020-01-02',
      requestedCheckIn: '2020-01-02T08:30:00.000Z',
      reason: 'Updated reason',
    })
    expect(attendanceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'att-1' },
        data: expect.objectContaining({ adjustmentReason: 'Updated reason' }),
      })
    )
  })
})

describe('listPendingAdjustments', () => {
  it('scopes a DEPT_MANAGER to requests routed to them', async () => {
    await listPendingAdjustments('office-bd', 'emp-manager', UserRole.DEPT_MANAGER)
    expect(attendanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ adjustmentStatus: 'PENDING', adjustmentApproverId: 'emp-manager' }),
      })
    )
  })

  it('lets an HR_MANAGER see every pending request in their office', async () => {
    await listPendingAdjustments('office-bd', 'emp-hr', UserRole.HR_MANAGER)
    expect(attendanceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ adjustmentStatus: 'PENDING', employee: { officeId: 'office-bd' } }),
      })
    )
  })
})

describe('reviewAdjustment', () => {
  it('rejects a DEPT_MANAGER who is not the resolved approver', async () => {
    RECORDS['att-1'] = makeRecord({ adjustmentStatus: 'PENDING', adjustmentApproverId: 'emp-other-manager', employee: { officeId: 'office-bd', departmentId: 'dept-1' } })
    attendanceFindUnique.mockResolvedValue(RECORDS['att-1'])
    await expect(
      reviewAdjustment('att-1', 'emp-manager', UserRole.DEPT_MANAGER, true, undefined, 'office-bd')
    ).rejects.toThrow('You are not authorized to review this request')
  })

  it('rejects a request from another office', async () => {
    RECORDS['att-1'] = makeRecord({ adjustmentStatus: 'PENDING', adjustmentApproverId: 'emp-hr', employee: { officeId: 'office-uk', departmentId: 'dept-1' } })
    attendanceFindUnique.mockResolvedValue(RECORDS['att-1'])
    await expect(
      reviewAdjustment('att-1', 'emp-hr', UserRole.HR_MANAGER, true, undefined, 'office-bd')
    ).rejects.toThrow('Attendance record not found')
  })

  it('recomputes status/times via computeAttendanceStatus on approval', async () => {
    RECORDS['att-1'] = makeRecord({
      adjustmentStatus: 'PENDING',
      adjustmentApproverId: 'emp-manager',
      requestedCheckIn: new Date('2020-01-02T09:00:00.000Z'),
      requestedCheckOut: new Date('2020-01-02T18:00:00.000Z'),
      employee: { officeId: 'office-bd', departmentId: 'dept-1' },
    })
    attendanceFindUnique.mockResolvedValue(RECORDS['att-1'])
    await reviewAdjustment('att-1', 'emp-manager', UserRole.DEPT_MANAGER, true, undefined, 'office-bd')
    expect(txAttendanceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'att-1', adjustmentStatus: 'PENDING' },
        data: expect.objectContaining({
          adjustmentStatus: 'APPROVED',
          adjustmentReviewedBy: 'emp-manager',
          checkIn: RECORDS['att-1'].requestedCheckIn,
          checkOut: RECORDS['att-1'].requestedCheckOut,
        }),
      })
    )
    expect(createNotification).toHaveBeenCalledWith(
      'emp-1',
      'ATTENDANCE_ADJUSTMENT_APPROVED',
      expect.any(String),
      expect.any(String),
      { attendanceId: 'att-1' }
    )
  })

  it('tags the record as a manual entry on approval, so it reads as an adjusted record rather than a normal self check-in', async () => {
    RECORDS['att-1'] = makeRecord({
      adjustmentStatus: 'PENDING',
      adjustmentApproverId: 'emp-manager',
      requestedCheckIn: new Date('2020-01-02T09:00:00.000Z'),
      requestedCheckOut: new Date('2020-01-02T18:00:00.000Z'),
      employee: { officeId: 'office-bd', departmentId: 'dept-1' },
    })
    attendanceFindUnique.mockResolvedValue(RECORDS['att-1'])
    await reviewAdjustment('att-1', 'emp-manager', UserRole.DEPT_MANAGER, true, undefined, 'office-bd')
    expect(txAttendanceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: 'MANUAL' }) })
    )
  })

  it('leaves checkIn/checkOut untouched on rejection', async () => {
    RECORDS['att-1'] = makeRecord({
      adjustmentStatus: 'PENDING',
      adjustmentApproverId: 'emp-manager',
      checkIn: null,
      checkOut: null,
      requestedCheckIn: new Date('2020-01-02T09:00:00.000Z'),
      employee: { officeId: 'office-bd', departmentId: 'dept-1' },
    })
    attendanceFindUnique.mockResolvedValue(RECORDS['att-1'])
    await reviewAdjustment('att-1', 'emp-manager', UserRole.DEPT_MANAGER, false, 'Times do not match', 'office-bd')
    expect(txAttendanceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adjustmentStatus: 'REJECTED' }),
      })
    )
    const call = txAttendanceUpdateMany.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(call.data.checkIn).toBeUndefined()
    expect(call.data.checkOut).toBeUndefined()
    expect(createNotification).toHaveBeenCalledWith(
      'emp-1',
      'ATTENDANCE_ADJUSTMENT_REJECTED',
      expect.any(String),
      expect.any(String),
      { attendanceId: 'att-1' }
    )
  })
})
