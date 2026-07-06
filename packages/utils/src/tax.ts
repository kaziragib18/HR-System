import type { TaxBreakdown, TaxSlab } from '@hr-system/types'
import { OfficeLocation } from '@hr-system/types'

// ─── Bangladesh Income Tax (FY 2024-25) ────────────────────────────────────

const BD_TAX_SLABS_2024: Array<{ from: number; to?: number; rate: number; label: string }> = [
  { from: 0, to: 350000, rate: 0, label: 'First BDT 3,50,000' },
  { from: 350000, to: 450000, rate: 0.05, label: 'Next BDT 1,00,000' },
  { from: 450000, to: 750000, rate: 0.1, label: 'Next BDT 3,00,000' },
  { from: 750000, to: 1150000, rate: 0.15, label: 'Next BDT 4,00,000' },
  { from: 1150000, to: 1550000, rate: 0.2, label: 'Next BDT 4,00,000' },
  { from: 1550000, rate: 0.25, label: 'Above BDT 15,50,000' },
]

function calculateBDTax(annualGross: number): TaxBreakdown {
  let remaining = annualGross
  let totalTax = 0
  const slabs: TaxSlab[] = []

  for (const slab of BD_TAX_SLABS_2024) {
    if (remaining <= 0) break
    const slabSize = slab.to !== undefined ? slab.to - slab.from : remaining
    const taxable = Math.min(remaining, slabSize)
    const taxAmount = taxable * slab.rate
    totalTax += taxAmount
    slabs.push({ from: slab.from, to: slab.to, rate: slab.rate, taxAmount, label: slab.label })
    remaining -= taxable
  }

  return {
    regime: 'BD_INCOME_TAX',
    taxableIncome: annualGross,
    totalTax: Math.round(totalTax),
    slabs,
  }
}

// ─── UK PAYE (Tax Year 2024-25) ─────────────────────────────────────────────

const UK_PERSONAL_ALLOWANCE_2024 = 12570
const UK_TAX_SLABS_2024: Array<{ from: number; to?: number; rate: number; label: string }> = [
  { from: 0, to: 12570, rate: 0, label: 'Personal allowance' },
  { from: 12570, to: 50270, rate: 0.2, label: 'Basic rate (20%)' },
  { from: 50270, to: 125140, rate: 0.4, label: 'Higher rate (40%)' },
  { from: 125140, rate: 0.45, label: 'Additional rate (45%)' },
]

// National Insurance Class 1 (employee) 2024-25
const UK_NI_SLABS_2024: Array<{ from: number; to?: number; rate: number; label: string }> = [
  { from: 0, to: 12570, rate: 0, label: 'Below Primary Threshold' },
  { from: 12570, to: 50270, rate: 0.08, label: 'Primary rate (8%)' },
  { from: 50270, rate: 0.02, label: 'Above Upper Earnings Limit (2%)' },
]

function calculateSlabTax(
  annualGross: number,
  slabs: typeof UK_TAX_SLABS_2024
): { totalTax: number; slabs: TaxSlab[] } {
  let remaining = annualGross
  let totalTax = 0
  const result: TaxSlab[] = []

  for (const slab of slabs) {
    if (remaining <= 0) break
    const slabSize = slab.to !== undefined ? slab.to - slab.from : remaining
    const taxable = Math.min(remaining, slabSize)
    const taxAmount = taxable * slab.rate
    totalTax += taxAmount
    result.push({ from: slab.from, to: slab.to, rate: slab.rate, taxAmount, label: slab.label })
    remaining -= taxable
  }

  return { totalTax: Math.round(totalTax), slabs: result }
}

function calculateUKPAYE(annualGross: number): TaxBreakdown {
  // Taper personal allowance above £100k (£1 reduction per £2 earned)
  let personalAllowance = UK_PERSONAL_ALLOWANCE_2024
  if (annualGross > 100000) {
    personalAllowance = Math.max(0, UK_PERSONAL_ALLOWANCE_2024 - (annualGross - 100000) / 2)
  }

  const adjustedSlabs = [
    { from: 0, to: personalAllowance, rate: 0, label: 'Personal allowance' },
    ...UK_TAX_SLABS_2024.slice(1),
  ]

  const { totalTax, slabs } = calculateSlabTax(annualGross, adjustedSlabs)
  const niResult = calculateSlabTax(annualGross, UK_NI_SLABS_2024)

  return {
    regime: 'UK_PAYE',
    taxableIncome: Math.max(0, annualGross - personalAllowance),
    totalTax: totalTax + niResult.totalTax,
    slabs: [
      ...slabs.map((s) => ({ ...s, label: `Tax: ${s.label}` })),
      ...niResult.slabs.map((s) => ({ ...s, label: `NI: ${s.label}` })),
    ],
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Calculates annual income tax for an employee.
 * Pass annualGross (yearly salary before tax).
 * Returns breakdown including per-slab amounts.
 */
export function calculateIncomeTax(
  annualGross: number,
  officeCode: string,
  _year?: number
): TaxBreakdown {
  if (officeCode === OfficeLocation.BD) return calculateBDTax(annualGross)
  if (officeCode === OfficeLocation.UK) return calculateUKPAYE(annualGross)
  throw new Error(`Unknown office code for tax calculation: ${officeCode}`)
}

/**
 * Converts annual tax to monthly deduction.
 */
export function monthlyTaxFromAnnual(annualTax: number): number {
  return Math.round(annualTax / 12)
}
