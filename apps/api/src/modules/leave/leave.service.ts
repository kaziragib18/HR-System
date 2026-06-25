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
  if (noticeDiff < leaveType.minNoticeDays) {
    throw new LeaveError(`This leave type requires ${leaveType.minNoticeDays} day(s) notice`)
  }

  // Fetch holidays for the office to calculate working days accurately
  const year = startDate.getFullYear()
  const holidays = await prisma.publicHoliday.findMany({
    where: { officeId },
    select: { date: true },
  })
  const holidayDates = holidays.map(h => ({ date: h.date.toISOString().split('T')[0] }))

  const totalDays = calculateTotalLeaveDays(input.startDate, input.endDate, holidayDates)
  if (totalDays <= 0) throw new LeaveError('Leave period has no working days')

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
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        totalDays,
        reason: input.reason,
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

/** Cancel own leave application. */
export async function cancelLeave(applicationId: string, employeeId: string) {
  const app = await prisma.leaveApplication.findUnique({
    where: { id: applicationId },
    include: { leaveType: true },
  })
  if (!app) throw new LeaveError('Leave application not found', 404)
  if (app.employeeId !== employeeId) throw new LeaveError('You can only cancel your own applications', 403)
  if (![LeaveStatus.PENDING, LeaveStatus.APPROVED].includes(app.status as LeaveStatus)) {
    throw new LeaveError('Cannot cancel this application')
  }

  const year = app.startDate.getFullYear()
  const wasApproved = app.status === LeaveStatus.APPROVED

  await prisma.$transaction(async (tx) => {
    await tx.leaveApplication.update({
      where: { id: applicationId },
      data: { status: LeaveStatus.CANCELLED, cancelledAt: new Date(), currentApproverId: null },
    })

    if (wasApproved) {
      await tx.leaveBalance.updateMany({
        where: { employeeId, leaveTypeId: app.leaveTypeId, year },
        data: { taken: { decrement: Number(app.totalDays) } },
      })
    } else {
      await tx.leaveBalance.updateMany({
        where: { employeeId, leaveTypeId: app.leaveTypeId, year },
        data: { pending: { decrement: Number(app.totalDays) } },
      })
    }
  })

  return { message: 'Application cancelled' }
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

/** Pending applications waiting for a specific approver. */
export async function pendingForApprover(approvingEmployeeId: string) {
  return prisma.leaveApplication.findMany({
    where: { status: LeaveStatus.PENDING, currentApproverId: approvingEmployeeId },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, avatarUrl: true } },
      leaveType: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
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
