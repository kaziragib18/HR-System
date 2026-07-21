import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { computeAttendanceStatus, BD_SHIFT, UK_SHIFT, toOfficeTime, type ShiftConfig } from '@hr-system/utils'
import { AttendanceStatus, AttendanceSource, NotificationType, UserRole } from '@hr-system/types'
import { parsePagination, buildPaginationMeta } from '@hr-system/utils'
import { createNotification, notifyOfficeAdmins } from '../../services/notification.service'
import { resolveTeamApprover, resolveApproverForRole, canActOnTeamRequest } from '../../services/approver-resolution.service'
import type { ManualEntryInput, BulkImportInput, ListAttendanceQuery, RequestAdjustmentInput, ReviewAdjustmentInput } from './attendance.schemas'

export class AttendanceError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

function shiftForOfficeCode(code: string): ShiftConfig {
  return code === 'BD' ? BD_SHIFT : UK_SHIFT
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

function datesBetween(start: Date, end: Date): Date[] {
  const dates: Date[] = []
  const cur = toDateOnly(start)
  const last = toDateOnly(end)
  while (cur <= last) {
    dates.push(new Date(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

/**
 * Called when a leave application is approved (or auto-approved) — without
 * this, a day the employee is on leave has no Attendance row at all (they
 * never check in), so the frontend's "no record → ABSENT" fallback shows
 * ABSENT instead of ON_LEAVE for that day. Skips weekends/holidays, and
 * skips any date that already has real attendance data (a genuine check-in)
 * rather than clobbering it.
 */
export async function markLeaveDates(employeeId: string, officeId: string, startDate: Date, endDate: Date): Promise<void> {
  for (const date of datesBetween(startDate, endDate)) {
    const dow = date.getUTCDay()
    if (dow === 0 || dow === 6) continue
    if (await isHoliday(officeId, date)) continue

    const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date } } })
    if (existing && existing.status !== AttendanceStatus.ABSENT && existing.status !== AttendanceStatus.ON_LEAVE) continue

    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: { employeeId, date, status: AttendanceStatus.ON_LEAVE, source: AttendanceSource.SYSTEM },
      update: { status: AttendanceStatus.ON_LEAVE, source: AttendanceSource.SYSTEM },
    })
  }
}

/**
 * Inverse of markLeaveDates — called when an approved leave's cancellation
 * is approved. Only removes the placeholder rows markLeaveDates created
 * (source SYSTEM + status ON_LEAVE); a real attendance record is never
 * touched. Cancellation is only ever allowed before the leave starts, so
 * these are always future dates that would otherwise render as ON_LEAVE
 * for a leave that no longer exists.
 */
export async function clearLeaveDates(employeeId: string, startDate: Date, endDate: Date): Promise<void> {
  await prisma.attendance.deleteMany({
    where: {
      employeeId,
      date: { gte: toDateOnly(startDate), lte: toDateOnly(endDate) },
      status: AttendanceStatus.ON_LEAVE,
      source: AttendanceSource.SYSTEM,
    },
  })
}

/** Self check-in for authenticated employee. */
export async function selfCheckIn(employeeId: string, officeId: string, remarks?: string) {
  // The office's current wall-clock time, not the server's real UTC instant —
  // shift.startTime/endTime and every check-in/check-out in this app are
  // office-local digits stored in a Date's UTC slots (see dateToMinutes in
  // packages/utils/src/attendance.ts). Capturing a true UTC instant here would
  // drift by the office's real UTC offset (e.g. BST is UTC+1 in summer).
  const office = await prisma.office.findUnique({ where: { id: officeId }, select: { code: true } })
  const now = toOfficeTime(new Date(), office?.code ?? 'UK')
  const today = toDateOnly(now)

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: today } },
  })

  if (existing?.checkIn) {
    throw new AttendanceError('Already checked in today')
  }

  const [holiday, onLeave] = await Promise.all([
    isHoliday(officeId, today),
    isOnApprovedLeave(employeeId, today),
  ])
  const dow = today.getUTCDay()
  const weekend = dow === 0 || dow === 6
  const shift = shiftForOfficeCode(office?.code ?? 'UK')

  const computed = computeAttendanceStatus(now, null, holiday, weekend, onLeave, shift)

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
      `Your check-in at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} is ${computed.lateMinutes} min late.`
    )
  }

  return record
}

/** Self check-out for authenticated employee. */
export async function selfCheckOut(employeeId: string, officeId: string, remarks?: string) {
  const office = await prisma.office.findUnique({ where: { id: officeId }, select: { code: true } })
  const now = toOfficeTime(new Date(), office?.code ?? 'UK')
  const today = toDateOnly(now)

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: today } },
  })

  if (!existing) throw new AttendanceError('No check-in found for today')
  if (existing.checkOut) throw new AttendanceError('Already checked out today')

  const [holiday, onLeave] = await Promise.all([
    isHoliday(officeId, today),
    isOnApprovedLeave(employeeId, today),
  ])
  const dow = today.getUTCDay()
  const weekend = dow === 0 || dow === 6
  const shift = shiftForOfficeCode(office?.code ?? 'UK')

  const computed = computeAttendanceStatus(existing.checkIn, now, holiday, weekend, onLeave, shift)

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
export async function listAttendance(
  officeScope: string | undefined,
  departmentScope: string | undefined,
  query: ListAttendanceQuery
) {
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

  const employeeFilter: Prisma.EmployeeWhereInput = {
    ...(officeScope ? { officeId: officeScope } : {}),
    // departmentScope (DEPT_HEAD/DEPT_MANAGER) always wins over a client-
    // supplied departmentId — this is the actual security boundary, not the
    // frontend dropdown. Also composes with query.employeeId below (via an
    // AND on the employee relation), so a caller can't bypass it by passing
    // an employeeId from outside their department.
    ...(departmentScope ? { departmentId: departmentScope } : query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.search ? {
      OR: [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { employeeId: { contains: query.search, mode: 'insensitive' } },
      ],
    } : {}),
  }

  const where: Prisma.AttendanceWhereInput = {
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...dateFilter,
    ...(Object.keys(employeeFilter).length > 0 ? { employee: employeeFilter } : {}),
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

/** Manual entry / correction by HR or a DEPT_HEAD/DEPT_MANAGER for their own department. */
export async function manualEntry(
  input: ManualEntryInput,
  actorId: string,
  officeScope?: string,
  departmentScope?: string,
  actorRole?: string,
  actorEmployeeId?: string
) {
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true, officeId: true, departmentId: true, user: { select: { role: true } } },
  })
  if (!employee) throw new AttendanceError('Employee not found', 404)
  if (officeScope && employee.officeId !== officeScope) throw new AttendanceError('Employee not found', 404)
  if (departmentScope && employee.departmentId !== departmentScope) {
    throw new AttendanceError('You can only edit attendance for your own department', 403)
  }
  // A DEPT_MANAGER can correct their team's attendance directly, but not
  // their own — their own correction still goes through the adjustment-
  // request flow so it routes to their DEPT_HEAD for approval.
  if (actorRole === UserRole.DEPT_MANAGER && actorEmployeeId === input.employeeId) {
    throw new AttendanceError('Submit an adjustment request for your own attendance — it needs your department head\'s approval', 403)
  }
  // A DEPT_MANAGER outranks no one above them in the department — they can't
  // directly edit their own DEPT_HEAD's attendance either, same reasoning.
  if (actorRole === UserRole.DEPT_MANAGER && employee.user?.role === UserRole.DEPT_HEAD) {
    throw new AttendanceError('You cannot edit your department head\'s attendance directly', 403)
  }

  const date = toDateOnly(input.date)
  const checkIn = input.checkIn ? new Date(input.checkIn) : null
  const checkOut = input.checkOut ? new Date(input.checkOut) : null

  const [office, holiday, onLeave] = await Promise.all([
    prisma.office.findUnique({ where: { id: employee.officeId }, select: { code: true } }),
    isHoliday(employee.officeId, date),
    isOnApprovedLeave(input.employeeId, date),
  ])
  const dow = date.getUTCDay()
  const weekend = dow === 0 || dow === 6
  const shift = shiftForOfficeCode(office?.code ?? 'UK')

  const computed = computeAttendanceStatus(checkIn, checkOut, holiday, weekend, onLeave, shift)

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

    const [office, holiday, onLeave] = await Promise.all([
      prisma.office.findUnique({ where: { id: employee.officeId }, select: { code: true } }),
      isHoliday(employee.officeId, date),
      isOnApprovedLeave(rec.employeeId, date),
    ])
    const dow = date.getUTCDay()
    const weekend = dow === 0 || dow === 6
    const shift = shiftForOfficeCode(office?.code ?? 'UK')
    const computed = computeAttendanceStatus(checkIn, checkOut, holiday, weekend, onLeave, shift)

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

/** Full calendar data for an employee: attendance records + leave applications for the month. */
export async function myCalendar(employeeId: string, month: number, year: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { office: { select: { code: true } } },
  })
  const shift = shiftForOfficeCode(emp?.office?.code ?? 'UK')

  const [records, leaves] = await Promise.all([
    prisma.attendance.findMany({
      where: { employeeId, date: { gte: start, lte: end } },
      select: {
        id: true, date: true, status: true,
        checkIn: true, checkOut: true,
        lateMinutes: true, workingMinutes: true,
        lateExcuse: true, excuseStatus: true,
      },
      orderBy: { date: 'asc' },
    }),
    prisma.leaveApplication.findMany({
      where: {
        employeeId,
        // Only active leaves — cancelled/cancel-requested must not appear on the calendar
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          { startDate: { gte: start, lte: end } },
          { endDate: { gte: start, lte: end } },
          { startDate: { lte: start }, endDate: { gte: end } },
        ],
      },
      include: { leaveType: { select: { name: true, code: true } } },
      orderBy: { startDate: 'asc' },
    }),
  ])

  return {
    records: records.map(r => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      checkIn: r.checkIn?.toISOString() ?? null,
      checkOut: r.checkOut?.toISOString() ?? null,
      lateMinutes: r.lateMinutes,
      workingMinutes: r.workingMinutes,
      lateExcuse: r.lateExcuse,
      excuseStatus: r.excuseStatus,
    })),
    leaves: leaves.map(l => ({
      id: l.id,
      startDate: (l.startDate as Date).toISOString().slice(0, 10),
      endDate: (l.endDate as Date).toISOString().slice(0, 10),
      type: l.leaveType.name,
      code: l.leaveType.code,
      status: l.status,
      reason: l.reason ?? null,
    })),
    officeStartTime: shift.startTime,
    officeEndTime: shift.endTime,
  }
}

/** Employee submits an excuse for a LATE attendance record. */
export async function submitLateExcuse(attendanceId: string, employeeId: string, excuse: string) {
  const record = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: {
      employee: {
        select: { officeId: true, firstName: true, lastName: true, user: { select: { role: true } } },
      },
    },
  })
  if (!record) throw new AttendanceError('Attendance record not found', 404)
  if (record.employeeId !== employeeId) throw new AttendanceError('Forbidden', 403)
  if (record.status !== 'LATE' && record.status !== 'HALF_DAY')
    throw new AttendanceError('Can only submit excuse for LATE or HALF_DAY attendance', 400)
  if (record.excuseStatus === 'APPROVED')
    throw new AttendanceError('Excuse already approved', 400)

  const approverId = await resolveTeamApprover(
    prisma,
    employeeId,
    record.employee.user?.role ?? UserRole.EMPLOYEE,
    record.employee.officeId
  )

  const updated = await prisma.attendance.update({
    where: { id: attendanceId },
    data: { lateExcuse: excuse, excuseStatus: 'PENDING', excuseApproverId: approverId },
  })

  const applicantName = `${record.employee.firstName} ${record.employee.lastName}`
  const dateLabel = record.date.toISOString().slice(0, 10)

  if (approverId) {
    const title = 'Late excuse submitted'
    const body = `${applicantName} submitted an excuse for a late arrival on ${dateLabel}.`
    await createNotification(approverId, NotificationType.ATTENDANCE_FLAGGED, title, body, { attendanceId })
    await notifyOfficeAdmins(record.employee.officeId, NotificationType.ATTENDANCE_FLAGGED, title, body, { attendanceId }, approverId)
  } else {
    // No manager/department head resolved for this employee (shouldn't happen once
    // every department has exactly one DEPT_HEAD) — fall back to every office admin
    // so the excuse doesn't sit unreviewed and unnoticed, mirroring the same
    // fallback requestAdjustment/applyLeave already use.
    await notifyOfficeAdmins(
      record.employee.officeId,
      NotificationType.ATTENDANCE_FLAGGED,
      'Late excuse submitted (no approver found)',
      `${applicantName} submitted a late excuse, but no manager or department head could be resolved for them.`,
      { attendanceId }
    )
  }

  return updated
}

/** Manager reviews a late excuse and optionally changes the attendance status. */
export async function reviewExcuse(
  attendanceId: string,
  managerId: string,
  managerRole: string,
  approved: boolean,
  officeScope: string | undefined,
  newStatus?: string
) {
  const record = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: { employee: { select: { officeId: true, departmentId: true } } },
  })
  if (!record) throw new AttendanceError('Attendance record not found', 404)
  if (officeScope && record.employee.officeId !== officeScope) throw new AttendanceError('Attendance record not found', 404)
  if (!record.lateExcuse) throw new AttendanceError('No excuse submitted for this record', 400)
  if (record.excuseStatus !== 'PENDING') throw new AttendanceError('Excuse already reviewed', 400)

  const authorized = await canActOnTeamRequest(prisma, managerId, managerRole, record.excuseApproverId, record.employee.departmentId)
  if (!authorized) throw new AttendanceError('You are not authorized to review this request', 403)

  const updated = await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      excuseStatus: approved ? 'APPROVED' : 'REJECTED',
      excuseReviewedAt: new Date(),
      excuseReviewedBy: managerId,
      ...(approved && newStatus ? { status: newStatus } : {}),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  // Notify employee of the decision
  await createNotification(
    record.employeeId,
    NotificationType.ATTENDANCE_FLAGGED,
    approved ? 'Late excuse approved' : 'Late excuse rejected',
    approved
      ? 'Your late excuse has been approved by your manager.'
      : 'Your late excuse was reviewed and not approved.'
  )

  return updated
}

/** List pending late excuses for manager review, scoped to the reviewer's resolved queue. */
export async function listPendingExcuses(officeScope: string | undefined, requesterEmployeeId: string, requesterRole: string) {
  const isAdmin = requesterRole === UserRole.SUPER_ADMIN || requesterRole === UserRole.HR_MANAGER

  return prisma.attendance.findMany({
    where: {
      excuseStatus: 'PENDING',
      ...(isAdmin
        ? officeScope ? { employee: { officeId: officeScope } } : {}
        : { excuseApproverId: requesterEmployeeId }),
    },
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, employeeId: true, avatarUrl: true,
          department: { select: { id: true, name: true } },
          user: { select: { role: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
    take: 50,
  })
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

/** Employee requests a check-in/check-out correction for a past day, with or without an existing record. */
export async function requestAdjustment(
  employeeId: string,
  officeId: string,
  requesterRole: string,
  input: RequestAdjustmentInput
) {
  const date = toDateOnly(input.date)
  const today = toDateOnly(new Date())
  if (date >= today) throw new AttendanceError('Adjustment requests can only be made for past days')

  const existing = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date } } })
  if (existing?.adjustmentStatus === 'PENDING') {
    throw new AttendanceError('An adjustment request is already pending for this record')
  }

  const requestedCheckIn = input.requestedCheckIn ? new Date(input.requestedCheckIn) : null
  const requestedCheckOut = input.requestedCheckOut ? new Date(input.requestedCheckOut) : null

  // A DEPT_HEAD's own attendance correction is the one exception to the usual
  // "escalates to the HR department head" rule (resolveTeamApprover) — it can
  // only be approved by HR_MANAGER/SUPER_ADMIN, since a HR_MANAGER approving
  // an ordinary team request would break their read-only status everywhere
  // else. Late-excuse and leave routing for DEPT_HEAD are unaffected.
  const approverId =
    requesterRole === UserRole.DEPT_HEAD
      ? await resolveApproverForRole(prisma, UserRole.HR_MANAGER, employeeId, officeId)
      : await resolveTeamApprover(prisma, employeeId, requesterRole, officeId)

  const record = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    create: {
      employeeId,
      date,
      status: AttendanceStatus.ABSENT,
      source: AttendanceSource.SELF,
      requestedCheckIn,
      requestedCheckOut,
      adjustmentReason: input.reason,
      adjustmentStatus: 'PENDING',
      adjustmentApproverId: approverId,
    },
    update: {
      requestedCheckIn,
      requestedCheckOut,
      adjustmentReason: input.reason,
      adjustmentStatus: 'PENDING',
      adjustmentApproverId: approverId,
    },
  })

  if (approverId) {
    const title = 'Attendance adjustment requested'
    const body = `An employee has requested a correction to their attendance for ${input.date}.`
    await createNotification(approverId, NotificationType.ATTENDANCE_ADJUSTMENT_REQUESTED, title, body, { attendanceId: record.id })
    // HR_MANAGER can't act on this (they're read-only on team requests), but
    // they can already see it office-wide via the GET queue — a notification
    // is just visibility, not a claim they can approve it, so they're
    // included here alongside SUPER_ADMIN.
    await notifyOfficeAdmins(officeId, NotificationType.ATTENDANCE_ADJUSTMENT_REQUESTED, title, body, { attendanceId: record.id }, approverId)
  } else {
    // No manager/department head resolved for this employee (shouldn't happen once
    // every department has exactly one DEPT_HEAD) — fall back to every office admin
    // so the request never goes unnoticed.
    await notifyOfficeAdmins(
      officeId,
      NotificationType.ATTENDANCE_ADJUSTMENT_REQUESTED,
      'Attendance adjustment requested',
      `An employee has requested a correction to their attendance for ${input.date}.`,
      { attendanceId: record.id }
    )
  }

  return record
}

/** Employee edits their own adjustment request while it is still pending review. */
export async function updateAdjustmentRequest(attendanceId: string, employeeId: string, input: RequestAdjustmentInput) {
  const record = await prisma.attendance.findUnique({ where: { id: attendanceId } })
  if (!record) throw new AttendanceError('Attendance record not found', 404)
  if (record.employeeId !== employeeId) throw new AttendanceError('You can only edit your own adjustment request', 403)
  if (record.adjustmentStatus !== 'PENDING') throw new AttendanceError('This request is no longer pending')

  return prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      requestedCheckIn: input.requestedCheckIn ? new Date(input.requestedCheckIn) : null,
      requestedCheckOut: input.requestedCheckOut ? new Date(input.requestedCheckOut) : null,
      adjustmentReason: input.reason,
    },
  })
}

/** List pending adjustment requests for manager review, scoped to the reviewer's resolved queue. */
export async function listPendingAdjustments(officeScope: string | undefined, requesterEmployeeId: string, requesterRole: string) {
  const isAdmin = requesterRole === UserRole.SUPER_ADMIN || requesterRole === UserRole.HR_MANAGER

  return prisma.attendance.findMany({
    where: {
      adjustmentStatus: 'PENDING',
      ...(isAdmin
        ? officeScope ? { employee: { officeId: officeScope } } : {}
        : { adjustmentApproverId: requesterEmployeeId }),
    },
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, employeeId: true, avatarUrl: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
    take: 50,
  })
}

/** Manager approves or rejects a pending adjustment request. */
export async function reviewAdjustment(
  attendanceId: string,
  reviewerId: string,
  reviewerRole: string,
  approved: boolean,
  rejectionReason: string | undefined,
  officeScope: string | undefined
) {
  const record = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    include: { employee: { select: { officeId: true, departmentId: true, user: { select: { role: true } } } } },
  })
  if (!record) throw new AttendanceError('Attendance record not found', 404)
  if (officeScope && record.employee.officeId !== officeScope) throw new AttendanceError('Attendance record not found', 404)
  if (record.adjustmentStatus !== 'PENDING') throw new AttendanceError('This request is no longer pending')

  // Mirrors the requestAdjustment carve-out: a DEPT_HEAD's own record can only
  // be approved by HR_MANAGER/SUPER_ADMIN — not their own DEPT_MANAGER(s), who
  // sit below them, and not via the usual resolved-approver/dept-head check.
  // HR_MANAGER stays fully read-only for every other requester.
  const targetIsDeptHead = record.employee.user?.role === UserRole.DEPT_HEAD
  const authorized = targetIsDeptHead
    ? reviewerRole === UserRole.SUPER_ADMIN || reviewerRole === UserRole.HR_MANAGER
    : await canActOnTeamRequest(prisma, reviewerId, reviewerRole, record.adjustmentApproverId, record.employee.departmentId)
  if (!authorized) {
    throw new AttendanceError('You are not authorized to review this request', 403)
  }

  const data: Prisma.AttendanceUpdateManyMutationInput = {
    adjustmentStatus: approved ? 'APPROVED' : 'REJECTED',
    adjustmentReviewedBy: reviewerId,
    adjustmentReviewedAt: new Date(),
  }

  if (approved) {
    const checkIn = record.requestedCheckIn ?? record.checkIn
    const checkOut = record.requestedCheckOut ?? record.checkOut
    const [office, holiday, onLeave] = await Promise.all([
      prisma.office.findUnique({ where: { id: record.employee.officeId }, select: { code: true } }),
      isHoliday(record.employee.officeId, record.date),
      isOnApprovedLeave(record.employeeId, record.date),
    ])
    const dow = record.date.getUTCDay()
    const weekend = dow === 0 || dow === 6
    const shift = shiftForOfficeCode(office?.code ?? 'UK')
    const computed = computeAttendanceStatus(checkIn, checkOut, holiday, weekend, onLeave, shift)

    data.checkIn = checkIn
    data.checkOut = checkOut
    data.status = computed.status
    data.lateMinutes = computed.lateMinutes
    data.earlyDepartureMinutes = computed.earlyDepartureMinutes
    data.overtimeMinutes = computed.overtimeMinutes
    data.workingMinutes = computed.workingMinutes
    data.source = AttendanceSource.MANUAL
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.attendance.updateMany({
      where: { id: attendanceId, adjustmentStatus: 'PENDING' },
      data,
    })
    if (count === 0) throw new AttendanceError('This request has already been processed')
  })

  await createNotification(
    record.employeeId,
    approved ? NotificationType.ATTENDANCE_ADJUSTMENT_APPROVED : NotificationType.ATTENDANCE_ADJUSTMENT_REJECTED,
    approved ? 'Attendance adjustment approved' : 'Attendance adjustment rejected',
    approved
      ? 'Your attendance adjustment request has been approved.'
      : `Your attendance adjustment request was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    { attendanceId }
  )

  return { message: approved ? 'Adjustment approved' : 'Adjustment rejected' }
}
