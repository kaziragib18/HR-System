import { describe, it, expect } from 'vitest'
import { calculateTotalLeaveDays, calculateProRataLeave, hasOverlap } from './leave-calculator'

describe('calculateTotalLeaveDays', () => {
  it('counts a single weekday as one day', () => {
    // 2026-07-06 is a Monday
    expect(calculateTotalLeaveDays('2026-07-06', '2026-07-06')).toBe(1)
  })

  it('excludes weekends from a range', () => {
    // 2026-07-06 (Mon) to 2026-07-12 (Sun) — one full week, 5 weekdays
    expect(calculateTotalLeaveDays('2026-07-06', '2026-07-12')).toBe(5)
  })

  it('excludes provided public holidays', () => {
    // Mon-Wed with Tuesday as a holiday
    expect(
      calculateTotalLeaveDays('2026-07-06', '2026-07-08', [{ date: '2026-07-07' }])
    ).toBe(2)
  })

  it('returns 0 when the end date is before the start date', () => {
    expect(calculateTotalLeaveDays('2026-07-10', '2026-07-06')).toBe(0)
  })
})

describe('calculateProRataLeave', () => {
  it('gives full entitlement for someone who joined on Jan 1', () => {
    expect(calculateProRataLeave(24, '2026-01-01', '2026-12-31')).toBe(24)
  })

  it('halves entitlement for someone joining at mid-year', () => {
    // Joining July 2nd of a 365-day year leaves ~183 days remaining — roughly half of 24
    const result = calculateProRataLeave(24, '2026-07-02', '2026-12-31')
    expect(result).toBeGreaterThan(11)
    expect(result).toBeLessThan(13)
  })

  it('rounds to the nearest half day', () => {
    const result = calculateProRataLeave(24, '2026-07-02', '2026-12-31')
    expect(result * 2).toBe(Math.round(result * 2))
  })
})

describe('hasOverlap', () => {
  it('detects an overlapping range', () => {
    expect(hasOverlap('2026-07-10', '2026-07-15', '2026-07-12', '2026-07-20')).toBe(true)
  })

  it('detects identical ranges as overlapping', () => {
    expect(hasOverlap('2026-07-10', '2026-07-15', '2026-07-10', '2026-07-15')).toBe(true)
  })

  it('returns false for adjacent, non-overlapping ranges', () => {
    expect(hasOverlap('2026-07-01', '2026-07-05', '2026-07-06', '2026-07-10')).toBe(false)
  })
})
