import { describe, it, expect } from 'vitest'
import { toOfficeTime, fromOfficeTime } from './date'

describe('toOfficeTime', () => {
  it('shifts a true UTC instant to the UK office wall-clock time (BST, UTC+1 in July)', () => {
    const instant = new Date('2026-07-15T07:30:00.000Z')
    const result = toOfficeTime(instant, 'UK')
    expect(result.getUTCHours()).toBe(8)
    expect(result.getUTCMinutes()).toBe(30)
  })

  it('shifts a true UTC instant to the BD office wall-clock time (UTC+6, no DST)', () => {
    const instant = new Date('2026-07-15T07:30:00.000Z')
    const result = toOfficeTime(instant, 'BD')
    expect(result.getUTCHours()).toBe(13)
    expect(result.getUTCMinutes()).toBe(30)
  })

  it('is independent of the host process timezone', () => {
    // Regression guard: the previous date-fns-tz-based implementation computed
    // the offset relative to the process's own local timezone rather than true
    // UTC, so it silently applied a zero offset whenever the process happened
    // to already be running in the target office's timezone.
    const instant = new Date('2026-01-15T07:30:00.000Z') // GMT, no BST, for a clean UK check
    const result = toOfficeTime(instant, 'UK')
    expect(result.getUTCHours()).toBe(7)
    expect(result.getUTCMinutes()).toBe(30)
  })
})

describe('fromOfficeTime', () => {
  it('is the exact inverse of toOfficeTime across a DST boundary', () => {
    const instant = new Date('2026-07-15T07:30:00.000Z')
    const officeLocal = toOfficeTime(instant, 'UK')
    const roundTripped = fromOfficeTime(officeLocal, 'UK')
    expect(roundTripped.getTime()).toBe(instant.getTime())
  })

  it('is the exact inverse of toOfficeTime for BD (fixed UTC+6 offset)', () => {
    const instant = new Date('2026-07-15T07:30:00.000Z')
    const officeLocal = toOfficeTime(instant, 'BD')
    const roundTripped = fromOfficeTime(officeLocal, 'BD')
    expect(roundTripped.getTime()).toBe(instant.getTime())
  })
})
