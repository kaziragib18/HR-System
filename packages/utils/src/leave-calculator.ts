import { parseISO, differenceInCalendarDays, addDays } from 'date-fns'
import { isWeekendDay } from './date'

export interface PublicHolidayDate {
  date: string
}

/**
 * Counts working days between two dates (inclusive) excluding weekends
 * and provided public holidays.
 */
export function calculateTotalLeaveDays(
  startDate: string,
  endDate: string,
  publicHolidays: PublicHolidayDate[] = []
): number {
  const start = parseISO(startDate)
  const end = parseISO(endDate)

  if (end < start) return 0

  const holidaySet = new Set(publicHolidays.map((h) => h.date.split('T')[0]))
  let count = 0
  const days = differenceInCalendarDays(end, start) + 1

  for (let i = 0; i < days; i++) {
    const current = addDays(start, i)
    const dateStr = current.toISOString().split('T')[0]
    if (!isWeekendDay(current) && !holidaySet.has(dateStr)) {
      count++
    }
  }

  return count
}

/**
 * Calculates pro-rata leave entitlement for an employee who joined mid-year.
 * Returns the number of days entitled from joining date to year end.
 */
export function calculateProRataLeave(
  fullYearEntitlement: number,
  joiningDate: string,
  yearEnd: string
): number {
  const joining = parseISO(joiningDate)
  const end = parseISO(yearEnd)
  const start = new Date(joining.getFullYear(), 0, 1) // Jan 1 of joining year
  const totalDaysInYear = differenceInCalendarDays(end, start) + 1
  const remainingDays = differenceInCalendarDays(end, joining) + 1
  const proRata = (fullYearEntitlement * remainingDays) / totalDaysInYear
  return Math.floor(proRata * 2) / 2 // round to nearest 0.5
}

/**
 * Checks whether a leave date range overlaps with an existing approved/pending leave.
 */
export function hasOverlap(
  newStart: string,
  newEnd: string,
  existingStart: string,
  existingEnd: string
): boolean {
  const ns = parseISO(newStart)
  const ne = parseISO(newEnd)
  const es = parseISO(existingStart)
  const ee = parseISO(existingEnd)
  return ns <= ee && ne >= es
}
