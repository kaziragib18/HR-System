import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { computeAttendanceStatus } from '@hr-system/utils'
import { AttendanceStatus, AttendanceSource, NotificationType } from '@hr-system/types'
import { parsePagination, buildPaginationMeta } from '@hr-system/utils'
import { createNotification } from '../../services/notification.service'
import type { ManualEntryInput, BulkImportInput, ListAttendanceQuery } from './attendance.schemas'

export class AttendanceError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

function toDateOnly(d: Date | string): Date {
  const dt = typeof d === 'string' ? new Date(d) : new Date(d)
  dt.setUTCHours(0, 0, 0, 0)
  return dt
}

async function isHoliday(officeId: string, date: Date): Promise<boolean> {
  const count = await prisma.publicHoliday.count({
    where: { officeId, date: { gte: toDateOnly(date), lt: new Date(toDateOnly(date).getTime() + 86400000) } },
  })
  return count > 0
}

async function isOnApprovedLeave(employeeId: string, date: Date): Promise<boolean> {
  const d = toDateOnly(date)
  const count = await prisma.leaveApplication.count({
    where: {
      employeeId,
      status: 'APPROVED',
      startDate: { lte: d },
      endDate: { gte: d },
    },
  })
  return count > 0
}

/** Self check-in for authenticated employee. */
export async function selfCheckIn(employeeId: string, officeId: string, remarks?: string) {
  const now = new Date()
  const today = toDateOnly(now)

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: today } },
  })

  if (existing?.checkIn) {
    throw new AttendanceError('Already checked in today')
  }

  const holiday = await isHoliday(officeId, today)
  const onLeave = await isOnApprovedLeave(employeeId, today)
  const dow = today.getUTCDay()
  const weekend = dow === 0 || dow === 6

  const computed = computeAttendanceStatus(now, null, holiday, weekend, onLeave)

  const record = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date: today } },
    create: {
      employeeId,
      date: today,
      checkIn: now,
      status: computed.status,
      lateMinutes: computed.lateMinutes,
      source: AttendanceSource.SELF,
      remarks,
    },
    update: {
      checkIn: now,
      status: computed.status,
      lateMinutes: computed.lateMinutes,
      source: AttendanceSource.SELF,
      remarks,
    },
  })

  if (computed.lateMinutes > 0) {
    await createNotification(
      employeeId,
      NotificationType.ATTENDANCE_FLAGGED,
      'Late arrival recorded',
      `Your check-in at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} is ${computed.lateMinutes} min late.`
    )
  }

  return record
}

/** Self check-out for authenticated employee. */
export async function selfCheckOut(employeeId: string, officeId: string, remarks?: string) {
  const now = new Date()
  const today = toDateOnly(now)

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: today } },
  })

  if (!existing) throw new AttendanceError('No check-in found for today')
  if (existing.checkOut) throw new AttendanceError('Already checked out today')

  const holiday = await isHoliday(officeId, today)
  const onLeave = await isOnApprovedLeave(employeeId, today)
  const dow = today.getUTCDay()
  const weekend = dow === 0 || dow === 6

  const computed = computeAttendanceStatus(existing.checkIn, now, holiday, weekend, onLeave)

  return prisma.attendance.update({
    where: { id: existing.id },
    data: {
      checkOut: now,
      status: computed.status,
      lateMinutes: computed.lateMinutes,
      earlyDepartureMinutes: computed.earlyDepartureMinutes,
      workingMinutes: computed.workingMinutes,
      overtimeMinutes: computed.overtimeMinutes,
      remarks,
    },
  })
}

/** Today's attendance record for the authenticated employee. */
export async function todayAttendance(employeeId: string) {
  return prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: toDateOnly(new Date()) } },
  })
}

/** List attendance (manager/HR view). */
export async function listAttendance(officeScope: string | undefined, query: ListAttendanceQuery) {
  const { skip, take, page, limit } = parsePagination(query)

  // Build date range from either explicit startDate/endDate or month/year
  let dateFilter: Prisma.AttendanceWhereInput = {}
  if (query.startDate || query.endDate) {
    dateFilter = {
      date: {
        ...(query.startDate ? { gte: toDateOnly(query.startDate) } : {}),
        ...(query.endDate ? { lte: toDateOnly(query.endDate) } : {}),
      },
    }
  } else if (query.month && query.year) {
    const start = new Date(Date.UTC(query.year, query.month - 1, 1))
    const end = new Date(Date.UTC(query.year, query.month, 0))
    dateFilter = { date: { gte: start, lte: end } }
  }

  const where: Prisma.AttendanceWhereInput = {
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...dateFilter,
    ...(officeScope ? { employee: { officeId: officeScope } } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, avatarUrl: true } },
      },
      skip,
      take,
      orderBy: [{ date: 'desc' }, { employee: { lastName: 'asc' } }],
    }),
    prisma.attendance.count({ where }),
  ])

  return { items, meta: buildPaginationMeta(total, page, limit) }
}

/** Employee's own attendance for a given month. */
export async function myMonthAttendance(employeeId: string, month: number, year: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))
  return prisma.attendance.findMany({
    where: { employeeId, date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  })
}

/** Manual entry / correction by HR or manager. */
export async function manualEntry(input: ManualEntryInput, actorId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, officeId: true },
  })
  if (!employee) throw new AttendanceError('Employee not found', 404)

  const date = toDateOnly(input.date)
  const checkIn = input.checkIn ? new Date(input.checkIn) : null
  const checkOut = input.checkOut ? new Date(input.checkOut) : null

  const holiday = await isHoliday(employee.officeId, date)
  const onLeave = await isOnApprovedLeave(input.employeeId, date)
  const dow = date.getUTCDay()
  const weekend = dow === 0 || dow === 6

  const computed = computeAttendanceStatus(checkIn, checkOut, holiday, weekend, onLeave)

  return prisma.attendance.upsert({
    where: { employeeId_date: { employeeId: input.employeeId, date } },
    create: {
      employeeId: input.employeeId,
      date,
      checkIn,
      checkOut,
      status: computed.status,
      lateMinutes: computed.lateMinutes,
      earlyDepartureMinutes: computed.earlyDepartureMinutes,
      workingMinutes: computed.workingMinutes,
      overtimeMinutes: computed.overtimeMinutes,
      source: AttendanceSource.MANUAL,
      approvedById: actorId,
      remarks: input.remarks,
    },
    update: {
      checkIn,
      checkOut,
      status: computed.status,
      lateMinutes: computed.lateMinutes,
      earlyDepartureMinutes: computed.earlyDepartureMinutes,
      workingMinutes: computed.workingMinutes,
      overtimeMinutes: computed.overtimeMinutes,
      source: AttendanceSource.MANUAL,
      approvedById: actorId,
      remarks: input.remarks,
    },
  })
}

/** Bulk import from biometric device (idempotent). */
export async function bulkImport(input: BulkImportInput) {
  const results = { created: 0, updated: 0, skipped: 0 }

  for (const rec of input.records) {
    const employee = await prisma.employee.findUnique({
      where: { id: rec.employeeId },
      select: { id: true, officeId: true },
    })
    if (!employee) { results.skipped++; continue }

    const date = toDateOnly(rec.date)
    const checkIn = rec.checkIn ? new Date(rec.checkIn) : null
    const checkOut = rec.checkOut ? new Date(rec.checkOut) : null

    const holiday = await isHoliday(employee.officeId, date)
    const onLeave = await isOnApprovedLeave(rec.employeeId, date)
    const dow = date.getUTCDay()
    const weekend = dow === 0 || dow === 6
    const computed = computeAttendanceStatus(checkIn, checkOut, holiday, weekend, onLeave)

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: rec.employeeId, date } },
    })

    if (existing) {
      await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          checkIn: checkIn ?? existing.checkIn,
          checkOut: checkOut ?? existing.checkOut,
          status: computed.status,
          lateMinutes: computed.lateMinutes,
          earlyDepartureMinutes: computed.earlyDepartureMinutes,
          workingMinutes: computed.workingMinutes,
          overtimeMinutes: computed.overtimeMinutes,
          source: rec.source as AttendanceSource,
          deviceId: rec.deviceId,
        },
      })
      results.updated++
    } else {
      await prisma.attendance.create({
        data: {
          employeeId: rec.employeeId,
          date,
          checkIn,
          checkOut,
          status: computed.status,
          lateMinutes: computed.lateMinutes,
          earlyDepartureMinutes: computed.earlyDepartureMinutes,
          workingMinutes: computed.workingMinutes,
          overtimeMinutes: computed.overtimeMinutes,
          source: rec.source as AttendanceSource,
          deviceId: rec.deviceId,
        },
      })
      results.created++
    }
  }

  return results
}

/** Summary stats for the attendance report page. */
export async function attendanceSummary(employeeId: string, month: number, year: number) {
  const records = await myMonthAttendance(employeeId, month, year)
  const counts: Record<string, number> = {}
  let totalWorking = 0
  for (const r of records) {
    counts[r.status] = (counts[r.status] ?? 0) + 1
    totalWorking += r.workingMinutes
  }
  return { counts, totalWorkingMinutes: totalWorking, records }
}
