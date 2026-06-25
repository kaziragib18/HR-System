import { TimesheetStatus } from './enums'

export interface TimesheetEntry {
  id: string
  date: string
  checkIn?: string | null
  checkOut?: string | null
  breakMinutes: number
  workMinutes: number
  projectCode?: string | null
  notes?: string | null
}

export interface Timesheet {
  id: string
  employee: { id: string; firstName: string; lastName: string; employeeId: string }
  weekStartDate: string
  weekEndDate: string
  totalMinutes: number
  overtimeMinutes: number
  status: TimesheetStatus
  submittedAt?: string | null
  approvedBy?: { id: string; firstName: string; lastName: string } | null
  approvedAt?: string | null
  rejectionReason?: string | null
  entries: TimesheetEntry[]
  createdAt: string
}
