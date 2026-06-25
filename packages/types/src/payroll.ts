import { PayrollStatus } from './enums'

export interface SalaryComponent {
  name: string
  amount: number
  isPercentage: boolean
  percentageOf?: string
}

export interface SalaryStructure {
  id: string
  employeeId?: string | null
  jobGradeId?: string | null
  basicSalary: number
  currency: string
  components: SalaryComponent[]
  effectiveFrom: string
  effectiveTo?: string | null
}

export interface PayrollEntry {
  id: string
  employee: { id: string; firstName: string; lastName: string; employeeId: string }
  grossSalary: number
  basicSalary: number
  allowances: number
  overtimePay: number
  deductions: number
  taxAmount: number
  pfContribution: number
  netSalary: number
  currency: string
  workingDays: number
  presentDays: number
  leaveDays: number
  overtimeMinutes: number
  taxBreakdown: TaxBreakdown
  payslipStoragePath?: string | null
}

export interface PayrollRun {
  id: string
  officeId: string
  officeCode: string
  month: number
  year: number
  status: PayrollStatus
  totalGross: number
  totalNet: number
  totalTax: number
  currency: string
  employeeCount: number
  processedAt?: string | null
  approvedAt?: string | null
  entries: PayrollEntry[]
  createdAt: string
}

export interface TaxBreakdown {
  regime: string
  taxableIncome: number
  totalTax: number
  slabs: TaxSlab[]
}

export interface TaxSlab {
  from: number
  to?: number
  rate: number
  taxAmount: number
  label: string
}
