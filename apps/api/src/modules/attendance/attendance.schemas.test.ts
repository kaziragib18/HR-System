import { describe, it, expect } from 'vitest'
import { requestAdjustmentSchema, reviewAdjustmentSchema } from './attendance.schemas'

describe('requestAdjustmentSchema', () => {
  const base = { date: '2026-07-01', reason: 'Forgot to check in on time' }

  it('accepts a request with only a proposed check-in time', () => {
    const result = requestAdjustmentSchema.safeParse({ ...base, requestedCheckIn: '2026-07-01T09:00:00.000Z' })
    expect(result.success).toBe(true)
  })

  it('accepts a request with only a proposed check-out time', () => {
    const result = requestAdjustmentSchema.safeParse({ ...base, requestedCheckOut: '2026-07-01T18:00:00.000Z' })
    expect(result.success).toBe(true)
  })

  it('rejects a request with neither a proposed check-in nor check-out time', () => {
    const result = requestAdjustmentSchema.safeParse(base)
    expect(result.success).toBe(false)
  })

  it('rejects a reason shorter than 5 characters', () => {
    const result = requestAdjustmentSchema.safeParse({ ...base, reason: 'hi', requestedCheckIn: '2026-07-01T09:00:00.000Z' })
    expect(result.success).toBe(false)
  })
})

describe('reviewAdjustmentSchema', () => {
  it('accepts an approval with no rejection reason', () => {
    expect(reviewAdjustmentSchema.safeParse({ approved: true }).success).toBe(true)
  })

  it('accepts a rejection with a reason', () => {
    expect(reviewAdjustmentSchema.safeParse({ approved: false, rejectionReason: 'Times do not match the badge log' }).success).toBe(true)
  })
})
