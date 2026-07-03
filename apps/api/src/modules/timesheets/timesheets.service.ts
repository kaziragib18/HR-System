import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { TimesheetStatus, NotificationType } from '@hr-system/types'
import { parsePagination, buildPaginationMeta } from '@hr-system/utils'
import { createNotification } from '../../services/notification.service'
import type { RejectTimesheetInput, ListTimesheetsQuery } from './timesheets.schemas'

export class TimesheetError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

const timesheetInclude = {
  employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, avatarUrl: true } },
  entries: { orderBy: { date: 'asc' as const } },
} satisfies Prisma.TimesheetInclude

/** Get Monday of a given date's week (ISO week starts Monday). */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart)
  d.setUTCDate(d.getUTCDate() + 6)
  return d
}

/** Auto-generate a draft timesheet from attendance records for a given week. */
export async function generateFromAttendance(employeeId: string, weekDate: Date) {
  const weekStart = getWeekStart(weekDate)
  const weekEnd = getWeekEnd(weekStart)

  // Skip if already exists
  const existing = await prisma.timesheet.findUnique({
    where: { employeeId_weekStartDate: { employeeId, weekStartDate: weekStart } },
  })
  if (existing) return existing

  // Pull attendance for the week
  const attendance = await prisma.attendance.findMany({
    where: { employeeId, date: { gte: weekStart, lte: weekEnd } },
    orderBy: { date: 'asc' },
  })

  const totalMinutes = attendance.reduce((s, a) => s + a.workingMinutes, 0)
  const overtimeMinutes = attendance.reduce((s, a) => s + a.overtimeMinutes, 0)

  return prisma.timesheet.create({
    data: {
      employeeId,
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      totalMinutes,
      overtimeMinutes,
      status: TimesheetStatus.DRAFT,
      entries: {
        create: attendance.map(a => ({
          date: a.date,
          checkIn: a.checkIn,
          checkOut: a.checkOut,
          workMinutes: a.workingMinutes,
        })),
      },
    },
    include: timesheetInclude,
  })
}

/** List employee's own timesheets. */
export async function myTimesheets(employeeId: string, query: ListTimesheetsQuery) {
  const { skip, take, page, limit } = parsePagination(query)

  const where: Prisma.TimesheetWhereInput = {
    employeeId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.month && query.year ? {
      weekStartDate: {
        gte: new Date(Date.UTC(query.year, query.month - 1, 1)),
        lte: new Date(Date.UTC(query.year, query.month, 0)),
      },
    } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.timesheet.findMany({ where, include: timesheetInclude, skip, take, orderBy: { weekStartDate: 'desc' } }),
    prisma.timesheet.count({ where }),
  ])

  return { items, meta: buildPaginationMeta(total, page, limit) }
}

/** Single timesheet with entries. */
export async function getTimesheet(id: string, employeeId: string, isManager: boolean) {
  const ts = await prisma.timesheet.findUnique({ where: { id }, include: timesheetInclude })
  if (!ts) throw new TimesheetError('Timesheet not found', 404)
  if (!isManager && ts.employeeId !== employeeId) throw new TimesheetError('Forbidden', 403)
  return ts
}

/** Submit a draft timesheet for approval. */
export async function submitTimesheet(id: string, employeeId: string) {
  const ts = await prisma.timesheet.findUnique({ where: { id } })
  if (!ts) throw new TimesheetError('Timesheet not found', 404)
  if (ts.employeeId !== employeeId) throw new TimesheetError('Forbidden', 403)
  if (ts.status !== TimesheetStatus.DRAFT) throw new TimesheetError('Only draft timesheets can be submitted')

  const updated = await prisma.timesheet.update({
    where: { id },
    data: { status: TimesheetStatus.SUBMITTED, submittedAt: new Date() },
    include: { employee: { select: { firstName: true, lastName: true, reportingToId: true } } },
  })

  // Notify reporting manager
  if (updated.employee.reportingToId) {
    await createNotification(
      updated.employee.reportingToId,
      NotificationType.TIMESHEET_SUBMITTED,
      'Timesheet submitted',
      `${updated.employee.firstName} ${updated.employee.lastName} submitted their timesheet for review.`,
      { timesheetId: id }
    )
  }

  return updated
}

/** Approve a timesheet (manager). */
export async function approveTimesheet(id: string, approverId: string) {
  const ts = await prisma.timesheet.findUnique({ where: { id } })
  if (!ts) throw new TimesheetError('Timesheet not found', 404)
  if (ts.status !== TimesheetStatus.SUBMITTED) throw new TimesheetError('Only submitted timesheets can be approved')

  const updated = await prisma.timesheet.update({
    where: { id },
    data: { status: TimesheetStatus.APPROVED, approvedById: approverId, approvedAt: new Date() },
  })

  await createNotification(
    ts.employeeId,
    NotificationType.TIMESHEET_APPROVED,
    'Timesheet approved',
    'Your timesheet has been approved.',
    { timesheetId: id }
  )

  return updated
}

/** Reject a timesheet (manager). */
export async function rejectTimesheet(id: string, rejectorId: string, input: RejectTimesheetInput) {
  const ts = await prisma.timesheet.findUnique({ where: { id } })
  if (!ts) throw new TimesheetError('Timesheet not found', 404)
  if (ts.status !== TimesheetStatus.SUBMITTED) throw new TimesheetError('Only submitted timesheets can be rejected')

  const updated = await prisma.timesheet.update({
    where: { id },
    data: {
      status: TimesheetStatus.DRAFT,
      rejectedById: rejectorId,
      rejectedAt: new Date(),
      rejectionReason: input.rejectionReason,
    },
  })

  await createNotification(
    ts.employeeId,
    NotificationType.TIMESHEET_REJECTED,
    'Timesheet returned',
    `Your timesheet was returned for corrections. Reason: ${input.rejectionReason}`,
    { timesheetId: id }
  )

  return updated
}

/** List all timesheets for manager/HR view. */
export async function listTimesheets(officeScope: string | undefined, query: ListTimesheetsQuery) {
  const { skip, take, page, limit } = parsePagination(query)

  const where: Prisma.TimesheetWhereInput = {
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(officeScope ? { employee: { officeId: officeScope } } : {}),
    ...(query.month && query.year ? {
      weekStartDate: {
        gte: new Date(Date.UTC(query.year, query.month - 1, 1)),
        lte: new Date(Date.UTC(query.year, query.month, 0)),
      },
    } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.timesheet.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeId: true,
            department: { select: { id: true, name: true } },
            user: { select: { role: true } },
          },
        },
      },
      skip,
      take,
      orderBy: { weekStartDate: 'desc' },
    }),
    prisma.timesheet.count({ where }),
  ])

  // Resolve approver / rejector names
  const actorIds = [...new Set([
    ...items.map(t => t.approvedById).filter(Boolean),
    ...items.map(t => t.rejectedById).filter(Boolean),
  ])] as string[]

  const actors = actorIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : []
  const actorMap = Object.fromEntries(actors.map(a => [a.id, `${a.firstName} ${a.lastName}`]))

  const enriched = items.map(t => ({
    ...t,
    approvedByName: t.approvedById ? actorMap[t.approvedById] ?? null : null,
    rejectedByName: t.rejectedById ? actorMap[t.rejectedById] ?? null : null,
  }))

  return { items: enriched, meta: buildPaginationMeta(total, page, limit) }
}
