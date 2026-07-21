import { prisma } from '../config/prisma'
import { logger } from '../config/logger'
import { LeaveStatus, NotificationType } from '@hr-system/types'
import { createNotification } from './notification.service'

function utcMidnight(offsetDays = 0): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d
}

const AUTO_REJECT_REASON =
  "Automatically rejected — no manager action was taken before the leave's start date."

/**
 * Rejects a single PENDING leave application whose start date has arrived,
 * mirroring rejectLeave's balance-release/history/notification shape but
 * with no human reviewer — the "actor" recorded in history is the approver
 * who had it pending (they didn't act in time), not a synthetic user.
 */
async function autoRejectOne(app: {
  id: string
  employeeId: string
  leaveTypeId: string
  totalDays: unknown
  approvalLevel: number
  currentApproverId: string | null
  startDate: Date
  employee: { firstName: string; lastName: string }
  leaveType: { name: string }
}): Promise<void> {
  const year = app.startDate.getFullYear()

  const rejected = await prisma.$transaction(async (tx) => {
    const { count } = await tx.leaveApplication.updateMany({
      where: { id: app.id, status: LeaveStatus.PENDING },
      data: {
        status: LeaveStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: AUTO_REJECT_REASON,
        currentApproverId: null,
      },
    })
    if (count === 0) return false

    if (app.currentApproverId) {
      await tx.leaveApprovalHistory.create({
        data: {
          applicationId: app.id,
          approverId: app.currentApproverId,
          action: 'REJECTED',
          level: app.approvalLevel,
          comment: AUTO_REJECT_REASON,
        },
      })
    }

    await tx.leaveBalance.updateMany({
      where: { employeeId: app.employeeId, leaveTypeId: app.leaveTypeId, year },
      data: { pending: { decrement: Number(app.totalDays) } },
    })

    return true
  })
  if (!rejected) return

  await createNotification(
    app.employeeId,
    NotificationType.LEAVE_REJECTED,
    'Leave request auto-rejected',
    `Your ${app.leaveType.name} application was automatically rejected because it was not reviewed before its start date.`,
    { applicationId: app.id }
  )

  if (app.currentApproverId) {
    const name = `${app.employee.firstName} ${app.employee.lastName}`
    await createNotification(
      app.currentApproverId,
      NotificationType.LEAVE_REJECTED,
      'A pending leave request auto-rejected',
      `${name}'s leave request reached its start date without a decision and was automatically rejected.`,
      { applicationId: app.id }
    )
  }
}

/**
 * Finds every still-PENDING leave application (excluding Sick Leave) whose
 * start date has arrived and rejects it. Sick Leave is deliberately excluded
 * — it stays PENDING indefinitely so a manager/department head/admin can
 * still approve it later, since it's often applied for same-day or
 * retroactively. Every other leave type is typically planned in advance, so
 * an undecided request sitting past its own start date is auto-rejected
 * rather than left open forever.
 */
async function autoRejectOverdueLeaves(): Promise<number> {
  const apps = await prisma.leaveApplication.findMany({
    where: {
      status: LeaveStatus.PENDING,
      startDate: { lte: utcMidnight() },
      leaveType: { code: { not: 'SL' } },
    },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      leaveType: { select: { name: true } },
    },
  })
  for (const app of apps) await autoRejectOne(app)
  return apps.length
}

/**
 * Reminds the resolved approver of every still-PENDING leave starting
 * tomorrow, once per application (reminderSentAt guards against re-sending
 * on the next sweep run later the same day).
 */
async function sendDayBeforeReminders(): Promise<number> {
  const apps = await prisma.leaveApplication.findMany({
    where: {
      status: LeaveStatus.PENDING,
      startDate: utcMidnight(1),
      reminderSentAt: null,
      currentApproverId: { not: null },
    },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      leaveType: { select: { name: true } },
    },
  })

  for (const app of apps) {
    const { count } = await prisma.leaveApplication.updateMany({
      where: { id: app.id, reminderSentAt: null },
      data: { reminderSentAt: new Date() },
    })
    if (count === 0) continue // another sweep tick already claimed this one

    const name = `${app.employee.firstName} ${app.employee.lastName}`
    await createNotification(
      app.currentApproverId!,
      NotificationType.LEAVE_REMINDER,
      'Leave request awaiting your approval',
      `${name}'s ${app.leaveType.name} request starts tomorrow and still needs your decision.`,
      { applicationId: app.id }
    )
  }
  return apps.length
}

/**
 * Periodic leave-lifecycle sweep — piggybacked onto the existing DB
 * keep-alive interval in index.ts rather than a real cron dependency, since
 * this app has no scheduled-job infrastructure. Safe to call repeatedly:
 * auto-reject re-checks `status: PENDING` atomically per row, and reminders
 * are guarded by `reminderSentAt`, so re-running a partially-completed sweep
 * (or overlapping ticks) never double-acts on the same application.
 */
export async function runLeaveLifecycleSweep(): Promise<void> {
  try {
    const [rejected, reminded] = await Promise.all([autoRejectOverdueLeaves(), sendDayBeforeReminders()])
    if (rejected || reminded) {
      logger.info({ rejected, reminded }, 'Leave lifecycle sweep completed')
    }
  } catch (err) {
    logger.error({ err }, 'Leave lifecycle sweep failed')
  }
}
