import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { calculateTotalLeaveDays } from '@hr-system/utils'
import { LeaveStatus, NotificationType } from '@hr-system/types'
import { parsePagination, buildPaginationMeta } from '@hr-system/utils'
import { createNotification } from '../../services/notification.service'
import type { ApplyLeaveInput, ApproveLeaveInput, RejectLeaveInput, LeaveApplicationsQuery } from './leave.schemas'

export class LeaveError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

interface ApprovalStep { level: number; role: string }

/** Active leave types for an office. */
export async function getLeaveTypes(officeId: string) {
  return prisma.leaveType.findMany({
    where: { officeId, isActive: true },
    orderBy: { name: 'asc' },
  })
}

/** Leave balances for an employee for a given year. */
export async function getLeaveBalances(employeeId: string, year: number) {
  return prisma.leaveBalance.findMany({
    where: { employeeId, year },
    include: {
      leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
    },
    orderBy: { leaveType: { name: 'asc' } },
  })
}

/** Apply for leave. Validates balance and sets approval chain. */
export async function applyLeave(employeeId: string, officeId: string, input: ApplyLeaveInput) {
  const leaveType = await prisma.leaveType.findFirst({
    where: { id: input.leaveTypeId, officeId, isActive: true },
  })
  if (!leaveType) throw new LeaveError('Leave type not found or not available for your office', 404)

  // Check notice days requirement
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const startDate = new Date(input.startDate)
  const noticeDiff = Math.floor((startDate.getTime() - today.getTime()) / 86400000)
  const isSickLeave = leaveType.code === 'SL'
  // Sick leave may be applied retroactively; all other types must meet the notice requirement
  // and cannot be applied for past dates
  if (!isSickLeave) {
    if (noticeDiff < 0) throw new LeaveError('You cannot apply for past dates for this leave type')
    if (leaveType.minNoticeDays > 0 && noticeDiff < leaveType.minNoticeDays) {
      throw new LeaveError(`This leave type requires ${leaveType.minNoticeDays} day(s) advance notice`)
    }
  }

  // Fetch holidays for the office to calculate working days accurately
  const year = startDate.getFullYear()
  const holidays = await prisma.publicHoliday.findMany({
    where: { officeId },
    select: { date: true },
  })
  const holidayDates = holidays.map(h => ({ date: h.date.toISOString().split('T')[0] }))

  let totalDays: number
  const consumeType = input.consumeType ?? 'FULL_DAY'

  if (consumeType === 'FIRST_HALF' || consumeType === 'SECOND_HALF') {
    // Half-day: must be a single working day
    if (input.startDate !== input.endDate) {
      throw new LeaveError('Half-day leave must be for a single day (start and end date must be the same)')
    }
    const workingDays = calculateTotalLeaveDays(input.startDate, input.endDate, holidayDates)
    if (workingDays <= 0) throw new LeaveError('Selected date is not a working day')
    totalDays = 0.5
  } else {
    totalDays = calculateTotalLeaveDays(input.startDate, input.endDate, holidayDates)
    if (totalDays <= 0) throw new LeaveError('Leave period has no working days')
  }

  if (leaveType.maxConsecutiveDays && totalDays > leaveType.maxConsecutiveDays) {
    throw new LeaveError(`Maximum consecutive days allowed is ${leaveType.maxConsecutiveDays}`)
  }

  // Check balance if leave type tracks days
  const balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: input.leaveTypeId, year } },
  })
  if (!balance) throw new LeaveError('No leave balance found for this type and year')

  const available = Number(balance.entitled) - Number(balance.taken) - Number(balance.pending)
  if (totalDays > available) {
    throw new LeaveError(`Insufficient leave balance. Available: ${available} days, Requested: ${totalDays} days`)
  }

  // Check for overlapping approved/pending leave
  const overlapping = await prisma.leaveApplication.count({
    where: {
      employeeId,
      status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      startDate: { lte: new Date(input.endDate) },
      endDate: { gte: new Date(input.startDate) },
    },
  })
  if (overlapping > 0) throw new LeaveError('You already have a leave application covering these dates')

  // Parse approval chain
  const approvalChain = (leaveType.approvalChain as unknown as ApprovalStep[]) ?? []

  // Find the first approver by role in the same office
  let currentApproverId: string | null = null
  if (approvalChain.length > 0) {
    const firstRole = approvalChain[0].role
    const approver = await prisma.user.findFirst({
      where: {
        employee: { officeId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } },
        role: firstRole,
      },
      select: { employeeId: true },
    })
    currentApproverId = approver?.employeeId ?? null
  }

  const application = await prisma.$transaction(async (tx) => {
    const app = await tx.leaveApplication.create({
      data: {
        employeeId,
        leaveTypeId: input.leaveTypeId,
        consumeType: consumeType,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        totalDays,
        reason: input.reason,
        location: input.location,
        attachmentPath: input.attachmentPath,
        status: approvalChain.length === 0 ? LeaveStatus.APPROVED : LeaveStatus.PENDING,
        approvalLevel: 1,
        currentApproverId,
      },
      include: { leaveType: { select: { name: true } }, employee: { select: { firstName: true, lastName: true } } },
    })

    // Reserve pending balance
    await tx.leaveBalance.update({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: input.leaveTypeId, year } },
      data: { pending: { increment: totalDays } },
    })

    // If auto-approved (no chain), deduct balance immediately
    if (approvalChain.length === 0) {
      await tx.leaveBalance.update({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: input.leaveTypeId, year } },
        data: { taken: { increment: totalDays }, pending: { decrement: totalDays } },
      })
    }

    return app
  })

  // Notify the first approver
  if (currentApproverId && application.status === LeaveStatus.PENDING) {
    const name = `${application.employee.firstName} ${application.employee.lastName}`
    await createNotification(
      currentApproverId,
      NotificationType.LEAVE_REQUESTED,
      'New leave request',
      `${name} has requested ${totalDays} day(s) of ${application.leaveType.name}.`,
      { applicationId: application.id }
    )
  }

  return application
}

/** Approve a leave application (advance level or final approval). */
export async function approveLeave(applicationId: string, approverId: string, approvingEmployeeId: string, input: ApproveLeaveInput) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { id: true, firstName: true, lastName: true, officeId: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.PENDING) throw new LeaveError('Application is not pending')

  const approvalChain = (app.leaveType.approvalChain as unknown as ApprovalStep[]) ?? []
  const currentLevel = app.approvalLevel
  const isFinalLevel = currentLevel >= approvalChain.length

  const year = app.startDate.getFullYear()

  const updated = await prisma.$transaction(async (tx) => {
    // Record approval history
    await tx.leaveApprovalHistory.create({
      data: {
        applicationId,
        approverId: approvingEmployeeId,
        action: isFinalLevel ? 'APPROVED' : 'FORWARDED',
        level: currentLevel,
        comment: input.comment,
      },
    })

    let nextApproverId: string | null = null
    let newStatus = app.status

    if (isFinalLevel) {
      newStatus = LeaveStatus.APPROVED
      // Move from pending to taken
      await tx.leaveBalance.updateMany({
        where: { employeeId: app.employeeId, leaveTypeId: app.leaveTypeId, year },
        data: { taken: { increment: Number(app.totalDays) }, pending: { decrement: Number(app.totalDays) } },
      })
    } else {
      // Find next level approver
      const nextStep = approvalChain[currentLevel] // index = currentLevel (0-indexed)
      if (nextStep) {
        const next = await tx.user.findFirst({
          where: { employee: { officeId: app.employee.officeId }, role: nextStep.role },
          select: { employeeId: true },
        })
        nextApproverId = next?.employeeId ?? null
      }
    }

    const result = await tx.leaveApplication.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        approvalLevel: isFinalLevel ? currentLevel : currentLevel + 1,
        currentApproverId: isFinalLevel ? null : nextApproverId,
        approvedById: isFinalLevel ? approvingEmployeeId : undefined,
        approvedAt: isFinalLevel ? new Date() : undefined,
      },
    })

    return { result, isFinalLevel, nextApproverId }
  })

  const appName = `${app.employee.firstName} ${app.employee.lastName}`

  if (updated.isFinalLevel) {
    await createNotification(
      app.employeeId,
      NotificationType.LEAVE_APPROVED,
      'Leave approved',
      `Your ${app.leaveType.name} application (${Number(app.totalDays)} days) has been approved.`,
      { applicationId }
    )
  } else if (updated.nextApproverId) {
    await createNotification(
      updated.nextApproverId,
      NotificationType.LEAVE_REQUESTED,
      'Leave request awaiting your approval',
      `${appName}'s leave request has been forwarded to you for approval.`,
      { applicationId }
    )
  }

  return updated.result
}

/** Reject a leave application. */
export async function rejectLeave(applicationId: string, rejectingEmployeeId: string, input: RejectLeaveInput) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: { leaveType: true, employee: { select: { id: true, firstName: true, lastName: true } } },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.PENDING) throw new LeaveError('Application is not pending')

  const year = app.startDate.getFullYear()

  await prisma.$transaction(async (tx) => {
    await tx.leaveApprovalHistory.create({
      data: {
        applicationId,
        approverId: rejectingEmployeeId,
        action: 'REJECTED',
        level: app.approvalLevel,
        comment: input.rejectionReason,
      },
    })

    await tx.leaveApplication.update({
      where: { id: applicationId },
      data: {
        status: LeaveStatus.REJECTED,
        rejectedById: rejectingEmployeeId,
        rejectedAt: new Date(),
        rejectionReason: input.rejectionReason,
        currentApproverId: null,
      },
    })

    // Release reserved balance
    await tx.leaveBalance.updateMany({
      where: { employeeId: app.employeeId, leaveTypeId: app.leaveTypeId, year },
      data: { pending: { decrement: Number(app.totalDays) } },
    })
  })

  await createNotification(
    app.employeeId,
    NotificationType.LEAVE_REJECTED,
    'Leave request rejected',
    `Your ${app.leaveType.name} application was rejected. Reason: ${input.rejectionReason}`,
    { applicationId }
  )

  return { message: 'Application rejected' }
}

/** Cancel own leave application.
 *  - PENDING → instant cancel (no reason required), removes from manager's queue
 *  - APPROVED → sets CANCEL_REQUESTED with reason, notifies the manager for approval
 */
export async function cancelLeave(applicationId: string, employeeId: string, cancelReason?: string) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { firstName: true, lastName: true, officeId: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.employeeId !== employeeId) throw new LeaveError('You can only cancel your own applications', 403)
  if (![LeaveStatus.PENDING, LeaveStatus.APPROVED].includes(app.status as LeaveStatus)) {
    throw new LeaveError('Cannot cancel this application')
  }

  const year = app.startDate.getFullYear()

  // Approved leaves: can only cancel before the leave has started
  if (app.status === LeaveStatus.APPROVED) {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    if (app.startDate <= today) {
      throw new LeaveError('Cannot cancel a leave that has already started or passed. Cancellation must be requested at least one day before the leave starts.')
    }
  }

  if (app.status === LeaveStatus.PENDING) {
    // Instant cancel — no reason needed, clear from manager's queue
    await prisma.$transaction(async (tx) => {
      await tx.leaveApplication.update({
        where: { id: applicationId },
        data: { status: LeaveStatus.CANCELLED, cancelledAt: new Date(), currentApproverId: null },
      })
      await tx.leaveBalance.updateMany({
        where: { employeeId, leaveTypeId: app.leaveTypeId, year },
        data: { pending: { decrement: Number(app.totalDays) } },
      })
    })
    return { message: 'Application cancelled' }
  }

  // APPROVED → request cancellation, needs manager approval
  if (!cancelReason?.trim()) throw new LeaveError('A reason is required to cancel an approved leave')

  // Find the original approver or any team lead in the office
  let managerId = app.currentApproverId
  if (!managerId) {
    const mgr = await prisma.user.findFirst({
      where: {
        employee: { officeId: app.employee.officeId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } },
        role: { in: ['TEAM_LEAD', 'HR_MANAGER', 'DEPT_HEAD'] },
      },
      select: { employeeId: true },
    })
    managerId = mgr?.employeeId ?? null
  }

  await prisma.leaveApplication.update({
    where: { id: applicationId },
    data: {
      status: LeaveStatus.CANCEL_REQUESTED,
      cancelReason: cancelReason.trim(),
      cancelRequestedAt: new Date(),
      currentApproverId: managerId,
    },
  })

  if (managerId) {
    const name = `${app.employee.firstName} ${app.employee.lastName}`
    await createNotification(
      managerId,
      NotificationType.LEAVE_CANCEL_REQUESTED,
      'Leave cancellation requested',
      `${name} has requested to cancel their approved ${app.leaveType.name} leave. Reason: ${cancelReason.trim()}`,
      { applicationId }
    )
  }

  return { message: 'Cancellation request submitted. Awaiting manager approval.' }
}

/** Employee updates the cancel reason while the request is still pending manager review. */
export async function updateCancelReason(applicationId: string, employeeId: string, newReason: string) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    select: { employeeId: true, status: true },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.employeeId !== employeeId) throw new LeaveError('Not authorised', 403)
  if (app.status !== LeaveStatus.CANCEL_REQUESTED) {
    throw new LeaveError('Cancel reason can only be updated while the cancellation is awaiting approval')
  }

  await prisma.leaveApplication.update({
    where: { id: applicationId },
    data: { cancelReason: newReason.trim() },
  })

  return { message: 'Cancel reason updated' }
}

/** Manager approves a cancellation request — restores leave balance and notifies employee. */
export async function approveCancelLeave(applicationId: string, approvingEmployeeId: string) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.CANCEL_REQUESTED) throw new LeaveError('This application has no pending cancellation request')

  const year = app.startDate.getFullYear()

  await prisma.$transaction(async (tx) => {
    await tx.leaveApprovalHistory.create({
      data: {
        applicationId,
        approverId: approvingEmployeeId,
        action: 'CANCEL_APPROVED',
        level: app.approvalLevel,
        comment: 'Cancellation approved',
      },
    })

    await tx.leaveApplication.update({
      where: { id: applicationId },
      data: {
        status: LeaveStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelApprovedById: approvingEmployeeId,
        cancelApprovedAt: new Date(),
        currentApproverId: null,
      },
    })

    // Restore taken balance
    await tx.leaveBalance.updateMany({
      where: { employeeId: app.employeeId, leaveTypeId: app.leaveTypeId, year },
      data: { taken: { decrement: Number(app.totalDays) } },
    })
  })

  await createNotification(
    app.employeeId,
    NotificationType.LEAVE_CANCEL_APPROVED,
    'Leave cancellation approved',
    `Your cancellation request for ${app.leaveType.name} leave has been approved. Your leave balance has been restored.`,
    { applicationId }
  )

  return { message: 'Cancellation approved' }
}

/** Manager rejects a cancellation request — leave stays APPROVED, employee notified. */
export async function rejectCancelLeave(applicationId: string, rejectingEmployeeId: string, reason: string) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { id: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.CANCEL_REQUESTED) throw new LeaveError('This application has no pending cancellation request')

  await prisma.$transaction(async (tx) => {
    await tx.leaveApprovalHistory.create({
      data: {
        applicationId,
        approverId: rejectingEmployeeId,
        action: 'CANCEL_REJECTED',
        level: app.approvalLevel,
        comment: reason,
      },
    })

    await tx.leaveApplication.update({
      where: { id: applicationId },
      data: {
        status: LeaveStatus.APPROVED,
        cancelReason: null,
        cancelRequestedAt: null,
        currentApproverId: null,
      },
    })
  })

  await createNotification(
    app.employeeId,
    NotificationType.LEAVE_CANCEL_REJECTED,
    'Leave cancellation rejected',
    `Your cancellation request for ${app.leaveType.name} leave was rejected. Reason: ${reason}`,
    { applicationId }
  )

  return { message: 'Cancellation request rejected' }
}

/** List applications — self or all (for manager/HR). */
export async function listApplications(
  requestingEmployeeId: string,
  officeScope: string | undefined,
  isSelf: boolean,
  query: LeaveApplicationsQuery
) {
  const { skip, take, page, limit } = parsePagination(query)

  const where: Prisma.LeaveApplicationWhereInput = {
    ...(isSelf ? { employeeId: requestingEmployeeId } : officeScope ? { employee: { officeId: officeScope } } : {}),
    ...(query.employeeId && !isSelf ? { employeeId: query.employeeId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.startDate ? { startDate: { gte: new Date(query.startDate) } } : {}),
    ...(query.endDate ? { endDate: { lte: new Date(query.endDate) } } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.leaveApplication.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, avatarUrl: true } },
        leaveType: { select: { id: true, name: true, code: true } },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.leaveApplication.count({ where }),
  ])

  return { items, meta: buildPaginationMeta(total, page, limit) }
}

/** Single application with approval history. */
export async function getApplication(id: string, requestingEmployeeId: string, isManager: boolean) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      leaveType: true,
      approvalHistory: {
        include: { application: false },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!app) throw new LeaveError('Application not found', 404)
  if (!isManager && app.employeeId !== requestingEmployeeId) throw new LeaveError('Forbidden', 403)
  return app
}

/** Pending (new + cancel-requested) applications waiting for a specific approver. */
export async function pendingForApprover(
  approvingEmployeeId: string,
  isAdmin: boolean,
  officeScope?: string,
) {
  const apps = await prisma.leaveApplication.findMany({
    where: {
      status: { in: [LeaveStatus.PENDING, LeaveStatus.CANCEL_REQUESTED] },
      // Admins see everything in their office scope; others see only their queue
      ...(isAdmin
        ? officeScope ? { employee: { officeId: officeScope } } : {}
        : { currentApproverId: approvingEmployeeId }),
    },
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, employeeId: true, avatarUrl: true,
          department: { select: { id: true, name: true } },
          user: { select: { role: true } },
        },
      },
      leaveType: { select: { id: true, name: true, code: true } },
      approvalHistory: {
        select: { id: true, approverId: true, action: true, level: true, comment: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  // Resolve approver names for history entries
  const allApproverIds: string[] = [...new Set(
    apps.flatMap(a => a.approvalHistory.map(h => h.approverId)).filter(Boolean)
  )]
  const approvers = allApproverIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: allApproverIds } },
        select: { id: true, firstName: true, lastName: true, jobTitle: { select: { name: true } } },
      })
    : []
  const approverMap = Object.fromEntries(approvers.map(e => [e.id, e]))
  return apps.map(app => ({
    ...app,
    approvalHistory: app.approvalHistory.map(h => ({
      ...h,
      approver: approverMap[h.approverId] ?? null,
    })),
  }))
}

/** Team leave calendar for a month. */
export async function leaveCalendar(officeId: string, month: number, year: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))

  return prisma.leaveApplication.findMany({
    where: {
      status: LeaveStatus.APPROVED,
      employee: { officeId },
      startDate: { lte: end },
      endDate: { gte: start },
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      leaveType: { select: { id: true, name: true, code: true } },
    },
    orderBy: { startDate: 'asc' },
  })
}
