import { describe, it, expect } from 'vitest'
import { OfficeLocation } from '@hr-system/types'
import { calculateIncomeTax, monthlyTaxFromAnnual } from './tax'

describe('calculateIncomeTax — BD', () => {
  it('charges no tax within the tax-free slab', () => {
    const result = calculateIncomeTax(300000, OfficeLocation.BD)
    expect(result.regime).toBe('BD_INCOME_TAX')
    expect(result.totalTax).toBe(0)
  })

  it('taxes exactly at a slab boundary', () => {
    const result = calculateIncomeTax(350000, OfficeLocation.BD)
    expect(result.totalTax).toBe(0)
  })

  it('applies the 5% rate just above the tax-free threshold', () => {
    const result = calculateIncomeTax(360000, OfficeLocation.BD)
    expect(result.totalTax).toBe(500) // 10,000 taxable at 5%
  })

  it('applies the top 25% rate above BDT 15,50,000', () => {
    const result = calculateIncomeTax(1650000, OfficeLocation.BD)
    // 100,000 * 5% + 300,000 * 10% + 400,000 * 15% + 400,000 * 20% + 100,000 * 25%
    expect(result.totalTax).toBe(5000 + 30000 + 60000 + 80000 + 25000)
  })
})

describe('calculateIncomeTax — UK', () => {
  it('charges no tax within the personal allowance', () => {
    const result = calculateIncomeTax(12000, OfficeLocation.UK)
    expect(result.regime).toBe('UK_PAYE')
    expect(result.totalTax).toBe(0)
  })

  it('applies basic rate tax plus NI above the personal allowance', () => {
    const result = calculateIncomeTax(20000, OfficeLocation.UK)
    const taxable = 20000 - 12570
    const expectedTax = Math.round(taxable * 0.2)
    const expectedNi = Math.round(taxable * 0.08)
    expect(result.totalTax).toBe(expectedTax + expectedNi)
  })

  it('tapers the personal allowance above £100,000', () => {
    const result = calculateIncomeTax(120000, OfficeLocation.UK)
    const expectedAllowance = 12570 - (120000 - 100000) / 2
    expect(result.taxableIncome).toBe(120000 - expectedAllowance)
  })

  // Regression guard: calculateSlabTax used to track "remaining" by the slab's
  // upper bound instead of the amount actually taxed, which truncated the
  // basic-rate band and skipped higher bands entirely for anyone crossing more
  // than one boundary above the personal allowance (~£50,270+).
  it('taxes every band an income crosses, not just the first', () => {
    const result = calculateIncomeTax(60000, OfficeLocation.UK)
    const incomeTax = (50270 - 12570) * 0.2 + (60000 - 50270) * 0.4
    const ni = (50270 - 12570) * 0.08 + (60000 - 50270) * 0.02
    expect(result.totalTax).toBe(Math.round(incomeTax) + Math.round(ni))
  })
})

it('throws for an unknown office code', () => {
  expect(() => calculateIncomeTax(50000, 'FR')).toThrow()
})

describe('monthlyTaxFromAnnual', () => {
  it('divides annual tax evenly by 12', () => {
    expect(monthlyTaxFromAnnual(120000)).toBe(10000)
  })

  it('rounds to the nearest whole unit', () => {
    expect(monthlyTaxFromAnnual(100)).toBe(8) // 100/12 = 8.33
  })
})
