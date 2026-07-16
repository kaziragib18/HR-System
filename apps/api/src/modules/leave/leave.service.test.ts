import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UserRole } from '@hr-system/types'

const txLeaveApplicationUpdateMany = vi.fn(async () => ({ count: 1 }))
const txLeaveApplicationCreate = vi.fn(async ({ data }: { data: any }) => ({
  id: 'app-1',
  ...data,
  employee: { firstName: 'A', lastName: 'B' },
  leaveType: { name: 'Annual Leave' },
}))
const txLeaveApplicationFindUniqueOrThrow = vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id }))
const txLeaveBalanceUpdate = vi.fn(async () => ({}))
const txLeaveBalanceUpdateMany = vi.fn(async () => ({}))
const txLeaveApprovalHistoryCreate = vi.fn(async () => ({}))

vi.mock('../../config/prisma', () => ({
  prisma: {
    leaveType: {
      findFirst: vi.fn(async () => ({
        id: 'lt-1', code: 'AL', minNoticeDays: 0, maxConsecutiveDays: null, approvalChain: [],
      })),
    },
    publicHoliday: { findMany: vi.fn(async () => []) },
    leaveBalance: {
      findUnique: vi.fn(async () => ({ entitled: 18, taken: 0, pending: 0 })),
      create: vi.fn(async ({ data }: { data: any }) => ({ taken: 0, pending: 0, ...data })),
    },
    leaveApplication: {
      count: vi.fn(async () => 0),
      findUnique: vi.fn(async () => null),
    },
    user: {
      findMany: vi.fn(async () => [{ employeeId: 'emp-admin-1' }, { employeeId: 'emp-admin-2' }]),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        leaveApplication: {
          create: txLeaveApplicationCreate,
          updateMany: txLeaveApplicationUpdateMany,
          findUniqueOrThrow: txLeaveApplicationFindUniqueOrThrow,
        },
        leaveBalance: { update: txLeaveBalanceUpdate, updateMany: txLeaveBalanceUpdateMany },
        leaveApprovalHistory: { create: txLeaveApprovalHistoryCreate },
      })
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

vi.mock('../attendance/attendance.service', () => ({
  markLeaveDates: vi.fn(async () => {}),
  clearLeaveDates: vi.fn(async () => {}),
}))

import { applyLeave, approveLeave, rejectLeave, approveCancelLeave } from './leave.service'
import { prisma } from '../../config/prisma'
import { resolveTeamApprover, canActOnTeamRequest } from '../../services/approver-resolution.service'
import { createNotification } from '../../services/notification.service'
import { markLeaveDates, clearLeaveDates } from '../attendance/attendance.service'

const leaveApplicationFindUnique = prisma.leaveApplication.findUnique as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  ;(resolveTeamApprover as ReturnType<typeof vi.fn>).mockResolvedValue('emp-manager')
  ;(canActOnTeamRequest as ReturnType<typeof vi.fn>).mockImplementation(
    async (_db: unknown, reviewerId: string, reviewerRole: string, resolvedApproverId: string | null) =>
      reviewerRole === UserRole.SUPER_ADMIN || resolvedApproverId === reviewerId
  )
  leaveApplicationFindUnique.mockResolvedValue(null)
  txLeaveApplicationUpdateMany.mockResolvedValue({ count: 1 })
})

describe('applyLeave', () => {
  it('resolves the approver via the reporting chain and stays PENDING', async () => {
    const app = await applyLeave('emp-1', 'office-bd', UserRole.EMPLOYEE, {
      leaveTypeId: 'lt-1', startDate: '2026-08-10', endDate: '2026-08-10', reason: 'trip',
    } as any)
    expect(resolveTeamApprover).toHaveBeenCalledWith(prisma, 'emp-1', UserRole.EMPLOYEE, 'office-bd')
    expect(txLeaveApplicationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', currentApproverId: 'emp-manager' }) })
    )
    expect(app).toBeDefined()
  })

  it('auto-approves and deducts balance immediately when no approver resolves at all', async () => {
    ;(resolveTeamApprover as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await applyLeave('emp-1', 'office-bd', UserRole.EMPLOYEE, {
      leaveTypeId: 'lt-1', startDate: '2026-08-10', endDate: '2026-08-10', reason: 'trip',
    } as any)
    expect(txLeaveApplicationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED', currentApproverId: null }) })
    )
    expect(txLeaveBalanceUpdate).toHaveBeenCalledTimes(2) // reserve pending + immediate deduct
    // Otherwise these days have no Attendance row at all (no check-in happens
    // while on leave) and fall back to ABSENT instead of ON_LEAVE.
    expect(markLeaveDates).toHaveBeenCalledWith('emp-1', 'office-bd', expect.any(Date), expect.any(Date))
  })

  it('notifies every SUPER_ADMIN in the office when no approver resolves, instead of going silent', async () => {
    ;(resolveTeamApprover as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await applyLeave('emp-1', 'office-bd', UserRole.EMPLOYEE, {
      leaveTypeId: 'lt-1', startDate: '2026-08-10', endDate: '2026-08-10', reason: 'trip',
    } as any)
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employee: { officeId: 'office-bd' }, role: UserRole.SUPER_ADMIN } })
    )
    expect(createNotification).toHaveBeenCalledWith(
      'emp-admin-1', 'LEAVE_REQUESTED', expect.any(String), expect.any(String), { applicationId: 'app-1' }
    )
    expect(createNotification).toHaveBeenCalledWith(
      'emp-admin-2', 'LEAVE_REQUESTED', expect.any(String), expect.any(String), { applicationId: 'app-1' }
    )
    expect(createNotification).toHaveBeenCalledTimes(2)
  })

  it("escalates a DEPT_HEAD requester's own application per resolveTeamApprover", async () => {
    await applyLeave('emp-head', 'office-bd', UserRole.DEPT_HEAD, {
      leaveTypeId: 'lt-1', startDate: '2026-08-10', endDate: '2026-08-10', reason: 'trip',
    } as any)
    expect(resolveTeamApprover).toHaveBeenCalledWith(prisma, 'emp-head', UserRole.DEPT_HEAD, 'office-bd')
  })

  it('lazily creates a zero-allowance balance row the first time an employee takes Compensatory Leave (CPL)', async () => {
    ;(prisma.leaveType.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'lt-cpl', code: 'CPL', minNoticeDays: 0, maxConsecutiveDays: null, approvalChain: [], daysPerYear: 0,
    })
    ;(prisma.leaveBalance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    await applyLeave('emp-1', 'office-bd', UserRole.EMPLOYEE, {
      leaveTypeId: 'lt-cpl', startDate: '2026-08-10', endDate: '2026-08-10', reason: 'worked a weekend',
    } as any)
    expect(prisma.leaveBalance.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leaveTypeId: 'lt-cpl', entitled: 0 }) })
    )
  })

  it('does not balance-gate CPL — allows it even though the zero-allowance balance leaves 0 available', async () => {
    ;(prisma.leaveType.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'lt-cpl', code: 'CPL', minNoticeDays: 0, maxConsecutiveDays: null, approvalChain: [], daysPerYear: 0,
    })
    // Existing CPL balance with 0 entitlement and 2 already taken (available would be negative).
    ;(prisma.leaveBalance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ entitled: 0, taken: 2, pending: 0 })
    const app = await applyLeave('emp-1', 'office-bd', UserRole.EMPLOYEE, {
      leaveTypeId: 'lt-cpl', startDate: '2026-08-10', endDate: '2026-08-10', reason: 'worked another weekend',
    } as any)
    expect(app).toBeDefined()
    expect(txLeaveApplicationCreate).toHaveBeenCalled()
  })

  it('still throws for a non-CPL leave type that has no balance row', async () => {
    ;(prisma.leaveBalance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    await expect(
      applyLeave('emp-1', 'office-bd', UserRole.EMPLOYEE, {
        leaveTypeId: 'lt-1', startDate: '2026-08-10', endDate: '2026-08-10', reason: 'trip',
      } as any)
    ).rejects.toThrow('No leave balance found')
    expect(prisma.leaveBalance.create).not.toHaveBeenCalled()
  })
})

describe('approveLeave', () => {
  function pendingApp(overrides: Partial<any> = {}) {
    return {
      id: 'app-1',
      employeeId: 'emp-1',
      status: 'PENDING',
      approvalLevel: 1,
      currentApproverId: 'emp-manager',
      totalDays: 1,
      leaveTypeId: 'lt-1',
      startDate: new Date('2026-08-10'),
      leaveType: { name: 'Annual Leave' },
      employee: { id: 'emp-1', firstName: 'A', lastName: 'B', officeId: 'office-bd', departmentId: 'dept-1' },
      ...overrides,
    }
  }

  it('rejects a reviewer who is neither the resolved approver nor an override', async () => {
    leaveApplicationFindUnique.mockResolvedValue(pendingApp())
    ;(canActOnTeamRequest as ReturnType<typeof vi.fn>).mockResolvedValue(false)
    await expect(
      approveLeave('app-1', 'emp-someone-else', UserRole.DEPT_MANAGER, { comment: '' } as any)
    ).rejects.toThrow('You are not authorized to review this application')
  })

  it('approves in a single step (no more multi-level forwarding) and moves balance to taken', async () => {
    leaveApplicationFindUnique.mockResolvedValue(pendingApp())
    await approveLeave('app-1', 'emp-manager', UserRole.DEPT_MANAGER, { comment: 'ok' } as any)

    expect(txLeaveApplicationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'app-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'APPROVED', currentApproverId: null, approvedById: 'emp-manager' }),
      })
    )
    expect(txLeaveApprovalHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'APPROVED' }) })
    )
    expect(txLeaveBalanceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ taken: { increment: 1 }, pending: { decrement: 1 } }) })
    )
    expect(createNotification).toHaveBeenCalledWith(
      'emp-1', 'LEAVE_APPROVED', expect.any(String), expect.any(String), { applicationId: 'app-1' }
    )
    expect(markLeaveDates).toHaveBeenCalledWith('emp-1', 'office-bd', pendingApp().startDate, undefined)
  })

  it('lets the department head override-approve even when routed to a different DEPT_MANAGER', async () => {
    leaveApplicationFindUnique.mockResolvedValue(pendingApp({ currentApproverId: 'emp-manager' }))
    ;(canActOnTeamRequest as ReturnType<typeof vi.fn>).mockResolvedValue(true) // dept head override
    await approveLeave('app-1', 'emp-depthead', UserRole.DEPT_HEAD, { comment: '' } as any)
    expect(txLeaveApplicationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ approvedById: 'emp-depthead' }) })
    )
  })
})

describe('rejectLeave', () => {
  it('rejects an unauthorized reviewer', async () => {
    leaveApplicationFindUnique.mockResolvedValue({
      id: 'app-1', status: 'PENDING', approvalLevel: 1, currentApproverId: 'emp-manager',
      employeeId: 'emp-1', totalDays: 1, leaveTypeId: 'lt-1', startDate: new Date('2026-08-10'),
      leaveType: { name: 'Annual Leave' },
      employee: { id: 'emp-1', firstName: 'A', lastName: 'B', departmentId: 'dept-1' },
    })
    ;(canActOnTeamRequest as ReturnType<typeof vi.fn>).mockResolvedValue(false)
    await expect(
      rejectLeave('app-1', 'emp-someone-else', UserRole.DEPT_MANAGER, { rejectionReason: 'no' } as any)
    ).rejects.toThrow('You are not authorized to review this application')
  })
})

describe('approveCancelLeave', () => {
  it('clears the ON_LEAVE placeholder attendance rows once a cancellation is approved', async () => {
    const startDate = new Date('2026-08-10')
    const endDate = new Date('2026-08-12')
    leaveApplicationFindUnique.mockResolvedValue({
      id: 'app-1', status: 'CANCEL_REQUESTED', approvalLevel: 1, currentApproverId: 'emp-manager',
      employeeId: 'emp-1', totalDays: 3, leaveTypeId: 'lt-1', startDate, endDate,
      leaveType: { name: 'Annual Leave' },
      employee: { id: 'emp-1', firstName: 'A', lastName: 'B', departmentId: 'dept-1' },
    })
    await approveCancelLeave('app-1', 'emp-manager', UserRole.DEPT_MANAGER)
    expect(clearLeaveDates).toHaveBeenCalledWith('emp-1', startDate, endDate)
  })
})
