import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { PayrollStatus, NotificationType } from '@hr-system/types'
import { parsePagination, buildPaginationMeta, calculateIncomeTax, monthlyTaxFromAnnual } from '@hr-system/utils'
import { createNotification } from '../../services/notification.service'
import { getEffectiveSalary, computeGross } from '../salary/salary.service'
import type { SalaryComponent } from '../salary/salary.schemas'
import type { CreatePayrollRunInput, ListPayrollRunsQuery, MyPayslipsQuery } from './payroll.schemas'

export class PayrollError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

const runInclude = {
  office: { select: { id: true, name: true, code: true, currency: true } },
} satisfies Prisma.PayrollRunInclude

const entryInclude = {
  employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, avatarUrl: true } },
} satisfies Prisma.PayrollEntryInclude

export async function createRun(officeId: string, input: CreatePayrollRunInput) {
  const office = await prisma.office.findUnique({ where: { id: officeId } })
  if (!office) throw new PayrollError('Office not found', 404)

  const existing = await prisma.payrollRun.findUnique({
    where: { officeId_month_year: { officeId, month: input.month, year: input.year } },
  })
  if (existing) throw new PayrollError(`Payroll run for ${input.month}/${input.year} already exists`)

  return prisma.payrollRun.create({
    data: {
      officeId,
      month: input.month,
      year: input.year,
      status: PayrollStatus.DRAFT,
      currency: office.currency,
    },
    include: runInclude,
  })
}

export async function listRuns(officeId: string | undefined, query: ListPayrollRunsQuery) {
  const { skip, take, page, limit } = parsePagination(query)
  const where: Prisma.PayrollRunWhereInput = officeId ? { officeId } : {}

  const [items, total] = await Promise.all([
    prisma.payrollRun.findMany({ where, skip, take, orderBy: [{ year: 'desc' }, { month: 'desc' }], include: runInclude }),
    prisma.payrollRun.count({ where }),
  ])

  return { items, meta: buildPaginationMeta(total, page, limit) }
}

export async function getRun(id: string) {
  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { ...runInclude, entries: { include: entryInclude, orderBy: { employee: { lastName: 'asc' } } } },
  })
  if (!run) throw new PayrollError('Payroll run not found', 404)
  return run
}

/**
 * Process a payroll run: calculate a PayrollEntry for every active employee in the office.
 * Reads salary structure, attendance for the month, and runs the tax engine.
 */
export async function processRun(id: string) {
  const run = await prisma.payrollRun.findUnique({ where: { id }, include: { office: true } })
  if (!run) throw new PayrollError('Payroll run not found', 404)
  if (run.status !== PayrollStatus.DRAFT) throw new PayrollError('Only DRAFT runs can be processed')

  await prisma.payrollRun.update({ where: { id }, data: { status: PayrollStatus.PROCESSING } })

  const employees = await prisma.employee.findMany({
    where: {
      officeId: run.officeId,
      employmentStatus: { in: ['ACTIVE', 'PROBATION'] },
    },
    select: { id: true, officeId: true },
  })

  const monthStart = new Date(Date.UTC(run.year, run.month - 1, 1))
  const monthEnd = new Date(Date.UTC(run.year, run.month, 0))

  let totalGross = 0
  let totalNet = 0
  let totalTax = 0

  // Delete any previously computed entries (idempotent re-process)
  await prisma.payrollEntry.deleteMany({ where: { payrollRunId: id } })

  for (const emp of employees) {
    const structure = await getEffectiveSalary(emp.id, monthStart)
    if (!structure) continue // No salary configured — skip

    const components = structure.components as unknown as SalaryComponent[]
    const basic = Number(structure.basicSalary)
    const { gross, allowances, deductions } = computeGross(basic, components)

    // Attendance for the month
    const attendance = await prisma.attendance.findMany({
      where: { employeeId: emp.id, date: { gte: monthStart, lte: monthEnd } },
    })

    const workingDays = new Date(run.year, run.month, 0).getDate() // crude: calendar days in month
    const presentDays = attendance.filter(a => ['PRESENT', 'LATE'].includes(a.status)).length
    const leaveDays = attendance.filter(a => a.status === 'ON_LEAVE').length
    const totalOvertimeMinutes = attendance.reduce((s, a) => s + a.overtimeMinutes, 0)

    // Pro-rate if employee was absent (absent = not present + not on leave)
    const absentDays = Math.max(0, workingDays - presentDays - leaveDays)
    const dailyRate = gross / workingDays
    const absentDeduction = dailyRate * absentDays

    // Overtime pay: hourly rate × overtime hours (hourly = monthly gross / 160 working hours)
    const hourlyRate = gross / 160
    const overtimePay = hourlyRate * 1.5 * (totalOvertimeMinutes / 60)

    const adjustedGross = gross - absentDeduction + overtimePay
    const annualGross = adjustedGross * 12

    const taxBreakdown = calculateIncomeTax(annualGross, run.office.code)
    const monthlyTax = monthlyTaxFromAnnual(taxBreakdown.totalTax)

    // PF: 10% of basic (BD custom, skip for UK where pension is separate)
    const pfContribution = run.office.code === 'BD' ? Math.round(basic * 0.1) : 0

    const netSalary = adjustedGross - monthlyTax - pfContribution

    await prisma.payrollEntry.create({
      data: {
        payrollRunId: id,
        employeeId: emp.id,
        grossSalary: Math.round(adjustedGross),
        basicSalary: basic,
        allowances: Math.round(allowances),
        overtimePay: Math.round(overtimePay),
        deductions: Math.round(deductions + absentDeduction),
        taxAmount: monthlyTax,
        pfContribution,
        netSalary: Math.max(0, Math.round(netSalary)),
        currency: structure.currency,
        workingDays,
        presentDays,
        leaveDays,
        overtimeMinutes: totalOvertimeMinutes,
        taxBreakdown: taxBreakdown as unknown as Prisma.InputJsonValue,
      },
    })

    totalGross += Math.round(adjustedGross)
    totalNet += Math.max(0, Math.round(netSalary))
    totalTax += monthlyTax
  }

  return prisma.payrollRun.update({
    where: { id },
    data: {
      status: PayrollStatus.DRAFT,
      totalGross,
      totalNet,
      totalTax,
      employeeCount: employees.length,
      processedAt: new Date(),
    },
    include: runInclude,
  })
}

export async function approveRun(id: string, approverId: string) {
  const run = await prisma.payrollRun.findUnique({ where: { id } })
  if (!run) throw new PayrollError('Payroll run not found', 404)
  if (run.status !== PayrollStatus.DRAFT || !run.processedAt)
    throw new PayrollError('Run must be processed before approving')

  return prisma.payrollRun.update({
    where: { id },
    data: { status: PayrollStatus.APPROVED, approvedById: approverId, approvedAt: new Date() },
    include: runInclude,
  })
}

export async function markPaid(id: string) {
  const run = await prisma.payrollRun.findUnique({ where: { id } })
  if (!run) throw new PayrollError('Payroll run not found', 404)
  if (run.status !== PayrollStatus.APPROVED) throw new PayrollError('Run must be approved before marking as paid')

  const updated = await prisma.payrollRun.update({
    where: { id },
    data: { status: PayrollStatus.PAID },
    include: { ...runInclude, entries: { select: { employeeId: true } } },
  })

  // Notify all employees
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  await Promise.all(
    updated.entries.map(e =>
      createNotification(
        e.employeeId,
        NotificationType.PAYSLIP_READY,
        'Payslip ready',
        `Your payslip for ${MONTH_NAMES[run.month - 1]} ${run.year} is now available.`,
        { payrollRunId: id }
      )
    )
  )

  return updated
}

export async function myPayslips(employeeId: string, query: MyPayslipsQuery) {
  const { skip, take, page, limit } = parsePagination(query)

  const [items, total] = await Promise.all([
    prisma.payrollEntry.findMany({
      where: { employeeId, payrollRun: { status: { in: [PayrollStatus.APPROVED, PayrollStatus.PAID] } } },
      skip,
      take,
      orderBy: { payrollRun: { year: 'desc' } },
      include: { payrollRun: { select: { id: true, month: true, year: true, status: true, currency: true } } },
    }),
    prisma.payrollEntry.count({
      where: { employeeId, payrollRun: { status: { in: [PayrollStatus.APPROVED, PayrollStatus.PAID] } } },
    }),
  ])

  return { items, meta: buildPaginationMeta(total, page, limit) }
}

export async function getMyPayslip(employeeId: string, runId: string) {
  const entry = await prisma.payrollEntry.findUnique({
    where: { payrollRunId_employeeId: { payrollRunId: runId, employeeId } },
    include: { payrollRun: { select: { id: true, month: true, year: true, status: true, currency: true } } },
  })
  if (!entry) throw new PayrollError('Payslip not found', 404)
  if (entry.payrollRun.status === PayrollStatus.DRAFT || entry.payrollRun.status === PayrollStatus.PROCESSING)
    throw new PayrollError('Payslip not yet available', 403)
  return entry
}
