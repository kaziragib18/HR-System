import { format, parseISO, isWeekend, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { OfficeLocation } from '@hr-system/types'

const OFFICE_TIMEZONES: Record<OfficeLocation, string> = {
  [OfficeLocation.BD]: 'Asia/Dhaka',
  [OfficeLocation.UK]: 'Europe/London',
}

export function getOfficeTimezone(officeCode: string): string {
  return OFFICE_TIMEZONES[officeCode as OfficeLocation] ?? 'UTC'
}

/**
 * Converts a real instant into a Date whose UTC-getter fields (getUTCHours(),
 * etc.) read as the wall-clock time in `officeCode`'s timezone at that
 * instant — matching this app's convention of storing office-local time in a
 * Date's UTC slots (see packages/utils/src/attendance.ts's dateToMinutes).
 *
 * Deliberately NOT implemented via date-fns-tz's toZonedTime/fromZonedTime:
 * that library (v3.1.3, as installed here) computes the offset relative to
 * the *process's own* local timezone rather than true UTC, so on a machine
 * whose system TZ happens to equal the target office's TZ it silently
 * applies zero offset — verified to reproduce exactly the "current time
 * 8:30 but check-in shows 7:30" bug this function was introduced to fix.
 * Intl.DateTimeFormat's `timeZone` option is unaffected by the process's own
 * default zone, so it's used directly instead.
 */
export function toOfficeTime(date: Date | string, officeCode: string): Date {
  const tz = getOfficeTimezone(officeCode)
  const d = typeof date === 'string' ? parseISO(date) : date
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')))
}

/** Inverse of toOfficeTime: given a Date whose UTC slots hold a wall-clock
 * time in `officeCode`'s timezone, returns the real absolute instant. */
export function fromOfficeTime(date: Date, officeCode: string): Date {
  const guess = new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()
  ))
  const offsetMs = toOfficeTime(guess, officeCode).getTime() - guess.getTime()
  return new Date(guess.getTime() - offsetMs)
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
