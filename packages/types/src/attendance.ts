import { AttendanceSource, AttendanceStatus } from './enums'

export interface AttendanceRecord {
  id: string
  employeeId: string
  employee: { firstName: string; lastName: string; employeeId: string }
  date: string
  checkIn?: string | null
  checkOut?: string | null
  status: AttendanceStatus
  lateMinutes: number
  earlyDepartureMinutes: number
  overtimeMinutes: number
  workingMinutes: number
  source: AttendanceSource
  remarks?: string | null
}

export interface AttendanceSummary {
  totalDays: number
  presentDays: number
  absentDays: number
  lateDays: number
  leaveDays: number
  holidayDays: number
  weekendDays: number
  totalOvertimeMinutes: number
}

export interface BulkAttendanceRecord {
  employeeId: string
  date: string
  checkIn?: string
  checkOut?: string
  source?: AttendanceSource
  deviceId?: string
}
