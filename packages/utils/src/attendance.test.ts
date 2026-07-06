import { describe, it, expect } from 'vitest'
import { AttendanceStatus } from '@hr-system/types'
import { computeAttendanceStatus, UK_SHIFT } from './attendance'

function timeOn(day: string, time: string): Date {
  return new Date(`${day}T${time}:00`)
}

describe('computeAttendanceStatus', () => {
  it('returns HOLIDAY status regardless of check-in', () => {
    const result = computeAttendanceStatus(timeOn('2026-07-06', '09:00'), null, true, false, false)
    expect(result.status).toBe(AttendanceStatus.HOLIDAY)
  })

  it('returns WEEKEND status regardless of check-in', () => {
    const result = computeAttendanceStatus(null, null, false, true, false)
    expect(result.status).toBe(AttendanceStatus.WEEKEND)
  })

  it('returns ABSENT when there is no check-in', () => {
    const result = computeAttendanceStatus(null, null, false, false, false)
    expect(result.status).toBe(AttendanceStatus.ABSENT)
  })

  it('returns PRESENT for an on-time check-in and check-out', () => {
    const result = computeAttendanceStatus(
      timeOn('2026-07-06', '09:00'),
      timeOn('2026-07-06', '17:00'),
      false,
      false,
      false,
      UK_SHIFT
    )
    expect(result.status).toBe(AttendanceStatus.PRESENT)
    expect(result.lateMinutes).toBe(0)
    expect(result.workingMinutes).toBe(8 * 60)
  })

  it('stays PRESENT within the late-arrival grace period', () => {
    const result = computeAttendanceStatus(
      timeOn('2026-07-06', '09:10'),
      timeOn('2026-07-06', '17:00'),
      false,
      false,
      false,
      UK_SHIFT
    )
    expect(result.status).toBe(AttendanceStatus.PRESENT)
    expect(result.lateMinutes).toBe(0)
  })

  it('flags LATE once the grace period is exceeded', () => {
    const result = computeAttendanceStatus(
      timeOn('2026-07-06', '09:30'),
      timeOn('2026-07-06', '17:00'),
      false,
      false,
      false,
      UK_SHIFT
    )
    expect(result.status).toBe(AttendanceStatus.LATE)
    expect(result.lateMinutes).toBe(15) // 30 min late - 15 min grace
  })

  it('flags EARLY_DEPARTURE for leaving well before shift end', () => {
    const result = computeAttendanceStatus(
      timeOn('2026-07-06', '09:00'),
      timeOn('2026-07-06', '16:00'),
      false,
      false,
      false,
      UK_SHIFT
    )
    expect(result.status).toBe(AttendanceStatus.EARLY_DEPARTURE)
  })

  it('flags HALF_DAY when both late and leaving early', () => {
    const result = computeAttendanceStatus(
      timeOn('2026-07-06', '09:30'),
      timeOn('2026-07-06', '16:00'),
      false,
      false,
      false,
      UK_SHIFT
    )
    expect(result.status).toBe(AttendanceStatus.HALF_DAY)
  })

  it('computes overtime minutes worked beyond shift duration', () => {
    const result = computeAttendanceStatus(
      timeOn('2026-07-06', '09:00'),
      timeOn('2026-07-06', '19:00'),
      false,
      false,
      false,
      UK_SHIFT
    )
    expect(result.overtimeMinutes).toBe(2 * 60)
  })
})
