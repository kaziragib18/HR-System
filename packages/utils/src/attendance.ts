import { AttendanceStatus } from '@hr-system/types'

export interface ShiftConfig {
  startTime: string // "HH:mm" e.g. "09:00"
  endTime: string   // "HH:mm" e.g. "18:00"
  lateGraceMinutes: number
  earlyDepartureGraceMinutes: number
}

const DEFAULT_SHIFT: ShiftConfig = {
  startTime: '09:00',
  endTime: '18:00',
  lateGraceMinutes: 15,
  earlyDepartureGraceMinutes: 15,
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function computeAttendanceStatus(
  checkIn: Date | null,
  checkOut: Date | null,
  isHoliday: boolean,
  isWeekend: boolean,
  isOnLeave: boolean,
  shift: ShiftConfig = DEFAULT_SHIFT
): {
  status: AttendanceStatus
  lateMinutes: number
  earlyDepartureMinutes: number
  workingMinutes: number
  overtimeMinutes: number
} {
  if (isHoliday) return { status: AttendanceStatus.HOLIDAY, lateMinutes: 0, earlyDepartureMinutes: 0, workingMinutes: 0, overtimeMinutes: 0 }
  if (isWeekend) return { status: AttendanceStatus.WEEKEND, lateMinutes: 0, earlyDepartureMinutes: 0, workingMinutes: 0, overtimeMinutes: 0 }
  if (isOnLeave) return { status: AttendanceStatus.ON_LEAVE, lateMinutes: 0, earlyDepartureMinutes: 0, workingMinutes: 0, overtimeMinutes: 0 }
  if (!checkIn) return { status: AttendanceStatus.ABSENT, lateMinutes: 0, earlyDepartureMinutes: 0, workingMinutes: 0, overtimeMinutes: 0 }

  const shiftStart = timeToMinutes(shift.startTime)
  const shiftEnd = timeToMinutes(shift.endTime)
  const checkInMinutes = dateToMinutes(checkIn)
  const checkOutMinutes = checkOut ? dateToMinutes(checkOut) : null

  const lateMinutes = Math.max(0, checkInMinutes - shiftStart - shift.lateGraceMinutes)

  const earlyDepartureMinutes = checkOutMinutes !== null
    ? Math.max(0, shiftEnd - checkOutMinutes - shift.earlyDepartureGraceMinutes)
    : 0

  const workingMinutes = checkOutMinutes !== null
    ? Math.max(0, checkOutMinutes - checkInMinutes)
    : 0

  const shiftDurationMinutes = shiftEnd - shiftStart
  const overtimeMinutes = checkOutMinutes !== null
    ? Math.max(0, workingMinutes - shiftDurationMinutes)
    : 0

  let status: AttendanceStatus
  if (lateMinutes > 0 && earlyDepartureMinutes > 0) {
    status = AttendanceStatus.HALF_DAY
  } else if (lateMinutes > 0) {
    status = AttendanceStatus.LATE
  } else if (earlyDepartureMinutes > 0) {
    status = AttendanceStatus.EARLY_DEPARTURE
  } else {
    status = AttendanceStatus.PRESENT
  }

  return { status, lateMinutes, earlyDepartureMinutes, workingMinutes, overtimeMinutes }
}
