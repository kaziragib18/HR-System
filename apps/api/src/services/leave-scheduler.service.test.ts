import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  txLeaveApplicationUpdateMany,
  txLeaveApprovalHistoryCreate,
  txLeaveBalanceUpdateMany,
  leaveApplicationFindMany,
  leaveApplicationUpdateMany,
} = vi.hoisted(() => ({
  txLeaveApplicationUpdateMany: vi.fn(async () => ({ count: 1 })),
  txLeaveApprovalHistoryCreate: vi.fn(async () => ({})),
  txLeaveBalanceUpdateMany: vi.fn(async () => ({})),
  leaveApplicationFindMany: vi.fn(async (_args?: any) => [] as any[]),
  leaveApplicationUpdateMany: vi.fn(async () => ({ count: 1 })),
}))

vi.mock('../config/prisma', () => ({
  prisma: {
    leaveApplication: {
      findMany: leaveApplicationFindMany,
      updateMany: leaveApplicationUpdateMany,
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        leaveApplication: { updateMany: txLeaveApplicationUpdateMany },
        leaveApprovalHistory: { create: txLeaveApprovalHistoryCreate },
        leaveBalance: { updateMany: txLeaveBalanceUpdateMany },
      })
    ),
  },
}))

vi.mock('./notification.service', () => ({
  createNotification: vi.fn(async () => {}),
}))

import { runLeaveLifecycleSweep } from './leave-scheduler.service'
import { createNotification } from './notification.service'

function makeApp(overrides: Partial<any> = {}) {
  return {
    id: 'app-1',
    employeeId: 'emp-1',
    leaveTypeId: 'lt-1',
    totalDays: 2,
    approvalLevel: 1,
    currentApproverId: 'emp-manager',
    startDate: new Date('2026-07-20'),
    employee: { firstName: 'Arif', lastName: 'Rahman' },
    leaveType: { name: 'Annual Leave' },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  leaveApplicationFindMany.mockResolvedValue([])
  leaveApplicationUpdateMany.mockResolvedValue({ count: 1 })
  txLeaveApplicationUpdateMany.mockResolvedValue({ count: 1 })
})

describe('runLeaveLifecycleSweep — auto-reject', () => {
  it('excludes Sick Leave from the overdue query — it stays open for a manager/head/admin to approve late', async () => {
    leaveApplicationFindMany.mockImplementation(async ({ where }: any) => (where.startDate?.lte ? [makeApp()] : []))

    await runLeaveLifecycleSweep()

    expect(leaveApplicationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PENDING', leaveType: { code: { not: 'SL' } } }),
      })
    )
  })

  it('rejects a PENDING leave whose start date has arrived, releases the pending balance, and notifies employee + approver', async () => {
    leaveApplicationFindMany.mockImplementation(async ({ where }: any) => {
      // First call is the auto-reject query (status/startDate<=today), second is reminders (startDate=tomorrow)
      return where.startDate?.lte ? [makeApp()] : []
    })

    await runLeaveLifecycleSweep()

    expect(txLeaveApplicationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'app-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'REJECTED', rejectionReason: expect.stringContaining('Automatically rejected') }),
      })
    )
    expect(txLeaveApprovalHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ applicationId: 'app-1', approverId: 'emp-manager', action: 'REJECTED' }) })
    )
    expect(txLeaveBalanceUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pending: { decrement: 2 } } })
    )
    expect(createNotification).toHaveBeenCalledWith(
      'emp-1', 'LEAVE_REJECTED', expect.any(String), expect.any(String), { applicationId: 'app-1' }
    )
    expect(createNotification).toHaveBeenCalledWith(
      'emp-manager', 'LEAVE_REJECTED', expect.any(String), expect.any(String), { applicationId: 'app-1' }
    )
  })

  it('does nothing if the application was already actioned concurrently (updateMany matches zero rows)', async () => {
    leaveApplicationFindMany.mockImplementation(async ({ where }: any) => (where.startDate?.lte ? [makeApp()] : []))
    txLeaveApplicationUpdateMany.mockResolvedValue({ count: 0 })

    await runLeaveLifecycleSweep()

    expect(txLeaveApprovalHistoryCreate).not.toHaveBeenCalled()
    expect(txLeaveBalanceUpdateMany).not.toHaveBeenCalled()
    expect(createNotification).not.toHaveBeenCalled()
  })

  it('skips the history write if there is no resolved approver on record', async () => {
    leaveApplicationFindMany.mockImplementation(async ({ where }: any) =>
      where.startDate?.lte ? [makeApp({ currentApproverId: null })] : []
    )

    await runLeaveLifecycleSweep()

    expect(txLeaveApprovalHistoryCreate).not.toHaveBeenCalled()
    expect(createNotification).toHaveBeenCalledWith(
      'emp-1', 'LEAVE_REJECTED', expect.any(String), expect.any(String), { applicationId: 'app-1' }
    )
    // No approver to remind-about-the-outcome for.
    expect(createNotification).toHaveBeenCalledTimes(1)
  })
})

describe('runLeaveLifecycleSweep — day-before reminders', () => {
  it('reminds the resolved approver of a PENDING leave starting tomorrow and marks it as reminded', async () => {
    leaveApplicationFindMany.mockImplementation(async ({ where }: any) => (where.startDate && !where.startDate.lte ? [makeApp()] : []))

    await runLeaveLifecycleSweep()

    expect(leaveApplicationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'app-1', reminderSentAt: null }, data: expect.objectContaining({ reminderSentAt: expect.any(Date) }) })
    )
    expect(createNotification).toHaveBeenCalledWith(
      'emp-manager', 'LEAVE_REMINDER', expect.any(String), expect.any(String), { applicationId: 'app-1' }
    )
  })

  it('does not send a duplicate reminder if another sweep tick already claimed it', async () => {
    leaveApplicationFindMany.mockImplementation(async ({ where }: any) => (where.startDate && !where.startDate.lte ? [makeApp()] : []))
    leaveApplicationUpdateMany.mockResolvedValue({ count: 0 })

    await runLeaveLifecycleSweep()

    expect(createNotification).not.toHaveBeenCalled()
  })
})

describe('runLeaveLifecycleSweep — resilience', () => {
  it('swallows errors instead of throwing (so the interval keeps running)', async () => {
    leaveApplicationFindMany.mockRejectedValue(new Error('db down'))
    await expect(runLeaveLifecycleSweep()).resolves.toBeUndefined()
  })
})
