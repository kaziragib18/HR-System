import { format, parseISO, isWeekend, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { OfficeLocation } from '@hr-system/types'

const OFFICE_TIMEZONES: Record<OfficeLocation, string> = {
  [OfficeLocation.BD]: 'Asia/Dhaka',
  [OfficeLocation.UK]: 'Europe/London',
}

export function getOfficeTimezone(officeCode: string): string {
  return OFFICE_TIMEZONES[officeCode as OfficeLocation] ?? 'UTC'
}

export function toOfficeTime(date: Date | string, officeCode: string): Date {
  const tz = getOfficeTimezone(officeCode)
  const d = typeof date === 'string' ? parseISO(date) : date
  return toZonedTime(d, tz)
}

export function fromOfficeTime(date: Date, officeCode: string): Date {
  const tz = getOfficeTimezone(officeCode)
  return fromZonedTime(date, tz)
}

export function formatDate(date: Date | string, fmt = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function formatDateTime(date: Date | string, fmt = 'dd MMM yyyy, HH:mm'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function isWeekendDay(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date
  return isWeekend(d)
}

export function getWeekBounds(date: Date | string): { start: Date; end: Date } {
  const d = typeof date === 'string' ? parseISO(date) : date
  return {
    start: startOfWeek(d, { weekStartsOn: 1 }),
    end: endOfWeek(d, { weekStartsOn: 1 }),
  }
}

export function getDatesInRange(startDate: Date | string, endDate: Date | string): Date[] {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate
  const dates: Date[] = []
  let current = start
  while (current <= end) {
    dates.push(new Date(current))
    current = addDays(current, 1)
  }
  return dates
}

export function getCurrentFiscalYear(officeCode: string): number {
  // BD fiscal year: July-June. UK: April-March.
  const now = new Date()
  if (officeCode === OfficeLocation.BD) {
    return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  }
  // UK fiscal year starts April (month 3)
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

export function getCalendarYear(): number {
  return new Date().getFullYear()
}
