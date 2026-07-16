import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { calculateTotalLeaveDays } from '@hr-system/utils'
import { LeaveStatus, NotificationType, UserRole } from '@hr-system/types'
import { parsePagination, buildPaginationMeta } from '@hr-system/utils'
import { createNotification } from '../../services/notification.service'
import { resolveTeamApprover, canActOnTeamRequest } from '../../services/approver-resolution.service'
import { markLeaveDates, clearLeaveDates } from '../attendance/attendance.service'
import type { ApplyLeaveInput, ApproveLeaveInput, RejectLeaveInput, LeaveApplicationsQuery } from './leave.schemas'

export class LeaveError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

/** Active leave types for an office. */
export async function getLeaveTypes(officeId: string) {
  return prisma.leaveType.findMany({
    where: { officeId, isActive: true },
    orderBy: { name: 'asc' },
  })
}

/** Leave balances for an employee for a given year. */
export async function getLeaveBalances(employeeId: string, year: number, officeScope?: string) {
  if (officeScope) {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { officeId: true } })
    if (!emp || emp.officeId !== officeScope) throw new LeaveError('Employee not found', 404)
  }
  return prisma.leaveBalance.findMany({
    where: { employeeId, year },
    include: {
      leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
    },
    orderBy: { leaveType: { name: 'asc' } },
  })
}

/** Apply for leave. Validates balance and resolves the approver via the real reporting chain. */
export async function applyLeave(employeeId: string, officeId: string, requesterRole: string, input: ApplyLeaveInput) {
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

  // Resolve the approver via the real reporting chain (DEPT_MANAGER, falling back to
  // DEPT_HEAD; DEPT_HEAD/HR_MANAGER requesters escalate to the HR department head).
  // LeaveType.approvalChain is no longer read for routing — see packages/types'
  // Theme-style comment pattern: kept in schema for historical LeaveApprovalHistory
  // display, but this app doesn't do multi-level sequential sign-off anymore.
  const currentApproverId = await resolveTeamApprover(prisma, employeeId, requesterRole, officeId)
  const autoApproved = !currentApproverId

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
        status: autoApproved ? LeaveStatus.APPROVED : LeaveStatus.PENDING,
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

    // If auto-approved (no approver could be resolved at all — shouldn't happen once
    // every department has exactly one DEPT_HEAD, but fail open rather than leaving
    // the application stuck pending forever with nobody able to act on it), deduct
    // balance immediately.
    if (autoApproved) {
      await tx.leaveBalance.update({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: input.leaveTypeId, year } },
        data: { taken: { increment: totalDays }, pending: { decrement: totalDays } },
      })
    }

    return app
  })

  const applicantName = `${application.employee.firstName} ${application.employee.lastName}`

  if (autoApproved) {
    // No Attendance row gets created for a day the employee is on leave (they
    // never check in), so without this, the day falls back to ABSENT instead
    // of ON_LEAVE — see markLeaveDates in attendance.service.ts.
    await markLeaveDates(employeeId, officeId, new Date(input.startDate), new Date(input.endDate))
  }

  if (currentApproverId && application.status === LeaveStatus.PENDING) {
    // Notify the resolved approver.
    await createNotification(
      currentApproverId,
      NotificationType.LEAVE_REQUESTED,
      'New leave request',
      `${applicantName} has requested ${totalDays} day(s) of ${application.leaveType.name}.`,
      { applicationId: application.id }
    )
  } else if (autoApproved) {
    // No manager/department head resolved for this employee (shouldn't happen
    // once every department has exactly one DEPT_HEAD, but the leave still
    // auto-approved silently — fall back to every SUPER_ADMIN in the office so
    // this doesn't go completely unnoticed, mirroring the same fallback
    // requestAdjustment already uses in attendance.service.ts).
    const superAdmins = await prisma.user.findMany({
      where: { employee: { officeId }, role: UserRole.SUPER_ADMIN },
      select: { employeeId: true },
    })
    for (const admin of superAdmins) {
      await createNotification(
        admin.employeeId,
        NotificationType.LEAVE_REQUESTED,
        'Leave auto-approved (no approver found)',
        `${applicantName}'s ${totalDays} day(s) of ${application.leaveType.name} was auto-approved because no manager or department head could be resolved for them.`,
        { applicationId: application.id }
      )
    }
  }

  return application
}

/** Approve a leave application. Single-step: DEPT_MANAGER/DEPT_HEAD approval is final. */
export async function approveLeave(
  applicationId: string,
  approvingEmployeeId: string,
  approverRole: string,
  input: ApproveLeaveInput
) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { id: true, firstName: true, lastName: true, officeId: true, departmentId: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.PENDING) throw new LeaveError('Application is not pending')

  const authorized = await canActOnTeamRequest(prisma, approvingEmployeeId, approverRole, app.currentApproverId, app.employee.departmentId)
  if (!authorized) throw new LeaveError('You are not authorized to review this application', 403)

  const year = app.startDate.getFullYear()

  const result = await prisma.$transaction(async (tx) => {
    // Guard the transition atomically — if another request already moved this
    // application off PENDING (double-click, retry, concurrent approve), this
    // matches zero rows and we bail out before touching history/balance.
    const { count } = await tx.leaveApplication.updateMany({
      where: { id: applicationId, status: LeaveStatus.PENDING },
      data: {
        status: LeaveStatus.APPROVED,
        currentApproverId: null,
        approvedById: approvingEmployeeId,
        approvedAt: new Date(),
      },
    })
    if (count === 0) throw new LeaveError('This application has already been processed')

    await tx.leaveApprovalHistory.create({
      data: {
        applicationId,
        approverId: approvingEmployeeId,
        action: 'APPROVED',
        level: app.approvalLevel,
        comment: input.comment,
      },
    })

    // Move from pending to taken
    await tx.leaveBalance.updateMany({
      where: { employeeId: app.employeeId, leaveTypeId: app.leaveTypeId, year },
      data: { taken: { increment: Number(app.totalDays) }, pending: { decrement: Number(app.totalDays) } },
    })

    return tx.leaveApplication.findUniqueOrThrow({ where: { id: applicationId } })
  })

  // Without this, days the employee is on leave have no Attendance row (they
  // never check in) and fall back to ABSENT instead of ON_LEAVE.
  await markLeaveDates(app.employeeId, app.employee.officeId, app.startDate, app.endDate)

  await createNotification(
    app.employeeId,
    NotificationType.LEAVE_APPROVED,
    'Leave approved',
    `Your ${app.leaveType.name} application (${Number(app.totalDays)} days) has been approved.`,
    { applicationId }
  )

  return result
}

/** Reject a leave application. */
export async function rejectLeave(applicationId: string, rejectingEmployeeId: string, rejectorRole: string, input: RejectLeaveInput) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: { leaveType: true, employee: { select: { id: true, firstName: true, lastName: true, departmentId: true } } },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.PENDING) throw new LeaveError('Application is not pending')

  const authorized = await canActOnTeamRequest(prisma, rejectingEmployeeId, rejectorRole, app.currentApproverId, app.employee.departmentId)
  if (!authorized) throw new LeaveError('You are not authorized to review this application', 403)

  const year = app.startDate.getFullYear()

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.leaveApplication.updateMany({
      where: { id: applicationId, status: LeaveStatus.PENDING },
      data: {
        status: LeaveStatus.REJECTED,
        rejectedById: rejectingEmployeeId,
        rejectedAt: new Date(),
        rejectionReason: input.rejectionReason,
        currentApproverId: null,
      },
    })
    if (count === 0) throw new LeaveError('This application has already been processed')

    await tx.leaveApprovalHistory.create({
      data: {
        applicationId,
        approverId: rejectingEmployeeId,
        action: 'REJECTED',
        level: app.approvalLevel,
        comment: input.rejectionReason,
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
      employee: { select: { firstName: true, lastName: true, officeId: true, departmentId: true, user: { select: { role: true } } } },
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
      const { count } = await tx.leaveApplication.updateMany({
        where: { id: applicationId, status: LeaveStatus.PENDING },
        data: { status: LeaveStatus.CANCELLED, cancelledAt: new Date(), currentApproverId: null },
      })
      if (count === 0) throw new LeaveError('This application has already been processed')

      await tx.leaveBalance.updateMany({
        where: { employeeId, leaveTypeId: app.leaveTypeId, year },
        data: { pending: { decrement: Number(app.totalDays) } },
      })
    })
    return { message: 'Application cancelled' }
  }

  // APPROVED → request cancellation, needs manager approval
  if (!cancelReason?.trim()) throw new LeaveError('A reason is required to cancel an approved leave')

  // The original approver (currentApproverId) was cleared when the application was
  // approved, so re-resolve via the same reporting-chain logic used at apply-time.
  const managerId = await resolveTeamApprover(
    prisma,
    employeeId,
    app.employee.user?.role ?? UserRole.EMPLOYEE,
    app.employee.officeId
  )

  const { count } = await prisma.leaveApplication.updateMany({
    where: { id: applicationId, status: LeaveStatus.APPROVED },
    data: {
      status: LeaveStatus.CANCEL_REQUESTED,
      cancelReason: cancelReason.trim(),
      cancelRequestedAt: new Date(),
      currentApproverId: managerId,
    },
  })
  if (count === 0) throw new LeaveError('This application has already been processed')

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
export async function approveCancelLeave(applicationId: string, approvingEmployeeId: string, approverRole: string) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { id: true, firstName: true, lastName: true, departmentId: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.CANCEL_REQUESTED) throw new LeaveError('This application has no pending cancellation request')

  const authorized = await canActOnTeamRequest(prisma, approvingEmployeeId, approverRole, app.currentApproverId, app.employee.departmentId)
  if (!authorized) throw new LeaveError('You are not authorized to review this cancellation request', 403)

  const year = app.startDate.getFullYear()

  await prisma.$transaction(async (tx) => {
    // Guard the transition atomically — if another request already resolved
    // this cancellation (double-click, retry, concurrent approve/reject),
    // this matches zero rows and we bail out before touching the balance.
    const { count } = await tx.leaveApplication.updateMany({
      where: { id: applicationId, status: LeaveStatus.CANCEL_REQUESTED },
      data: {
        status: LeaveStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelApprovedById: approvingEmployeeId,
        cancelApprovedAt: new Date(),
        currentApproverId: null,
      },
    })
    if (count === 0) throw new LeaveError('This cancellation request has already been processed')

    await tx.leaveApprovalHistory.create({
      data: {
        applicationId,
        approverId: approvingEmployeeId,
        action: 'CANCEL_APPROVED',
        level: app.approvalLevel,
        comment: 'Cancellation approved',
      },
    })

    // Restore taken balance
    await tx.leaveBalance.updateMany({
      where: { employeeId: app.employeeId, leaveTypeId: app.leaveTypeId, year },
      data: { taken: { decrement: Number(app.totalDays) } },
    })
  })

  // Cancellation is only ever allowed before the leave starts, so these are
  // always future placeholder rows markLeaveDates created — remove them, or
  // the calendar keeps showing ON_LEAVE for a leave that no longer exists.
  await clearLeaveDates(app.employeeId, app.startDate, app.endDate)

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
export async function rejectCancelLeave(applicationId: string, rejectingEmployeeId: string, rejectorRole: string, reason: string) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: {
      leaveType: true,
      employee: { select: { id: true, departmentId: true } },
    },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.status !== LeaveStatus.CANCEL_REQUESTED) throw new LeaveError('This application has no pending cancellation request')

  const authorized = await canActOnTeamRequest(prisma, rejectingEmployeeId, rejectorRole, app.currentApproverId, app.employee.departmentId)
  if (!authorized) throw new LeaveError('You are not authorized to review this cancellation request', 403)

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.leaveApplication.updateMany({
      where: { id: applicationId, status: LeaveStatus.CANCEL_REQUESTED },
      data: {
        status: LeaveStatus.APPROVED,
        cancelReason: null,
        cancelRequestedAt: null,
        currentApproverId: null,
      },
    })
    if (count === 0) throw new LeaveError('This cancellation request has already been processed')

    await tx.leaveApprovalHistory.create({
      data: {
        applicationId,
        approverId: rejectingEmployeeId,
        action: 'CANCEL_REJECTED',
        level: app.approvalLevel,
        comment: reason,
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
export async function getApplication(id: string, requestingEmployeeId: string, isManager: boolean, officeScope?: string) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, officeId: true } },
      leaveType: true,
      approvalHistory: {
        include: { application: false },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!app) throw new LeaveError('Application not found', 404)
  if (officeScope && app.employee.officeId !== officeScope) throw new LeaveError('Application not found', 404)
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
