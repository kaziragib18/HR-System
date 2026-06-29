import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { parsePagination, buildPaginationMeta } from '@hr-system/utils'
import type { CreateSalaryStructureInput, ListSalaryQuery, SalaryComponent } from './salary.schemas'

export class SalaryError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

/** Resolve the effective salary structure for an employee (employee-level overrides job-grade default). */
export async function getEffectiveSalary(employeeId: string, asOf: Date = new Date()) {
  // 1. Employee-specific structure takes priority
  const employeeStructure = await prisma.salaryStructure.findFirst({
    where: {
      employeeId,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  })
  if (employeeStructure) return employeeStructure

  // 2. Fall back to the employee's job grade structure
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { jobGradeId: true },
  })
  if (!employee?.jobGradeId) return null

  return prisma.salaryStructure.findFirst({
    where: {
      jobGradeId: employee.jobGradeId,
      employeeId: null,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  })
}

export async function createSalaryStructure(input: CreateSalaryStructureInput) {
  if (input.employeeId) {
    const exists = await prisma.employee.findUnique({ where: { id: input.employeeId } })
    if (!exists) throw new SalaryError('Employee not found', 404)
  }
  if (input.jobGradeId) {
    const exists = await prisma.jobGrade.findUnique({ where: { id: input.jobGradeId } })
    if (!exists) throw new SalaryError('Job grade not found', 404)
  }

  return prisma.salaryStructure.create({
    data: {
      employeeId: input.employeeId ?? null,
      jobGradeId: input.jobGradeId ?? null,
      basicSalary: input.basicSalary,
      currency: input.currency,
      components: input.components as unknown as Prisma.InputJsonValue,
      effectiveFrom: new Date(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      jobGrade: { select: { id: true, name: true } },
    },
  })
}

export async function listSalaryStructures(query: ListSalaryQuery) {
  const { skip, take, page, limit } = parsePagination(query)

  const where: Prisma.SalaryStructureWhereInput = {
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.jobGradeId ? { jobGradeId: query.jobGradeId } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.salaryStructure.findMany({
      where,
      skip,
      take,
      orderBy: { effectiveFrom: 'desc' },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        jobGrade: { select: { id: true, name: true } },
      },
    }),
    prisma.salaryStructure.count({ where }),
  ])

  return { items, meta: buildPaginationMeta(total, page, limit) }
}

export async function getEmployeeSalary(employeeId: string) {
  const structure = await getEffectiveSalary(employeeId)
  if (!structure) throw new SalaryError('No salary structure found for this employee', 404)
  return structure
}

/** Compute gross from a salary structure's components. */
export function computeGross(basicSalary: number, components: SalaryComponent[]): {
  gross: number
  allowances: number
  deductions: number
} {
  let allowances = 0
  let deductions = 0

  for (const c of components) {
    const amount = c.isPercentage ? (basicSalary * c.amount) / 100 : c.amount
    if (c.type === 'ALLOWANCE') allowances += amount
    else deductions += amount
  }

  return {
    gross: basicSalary + allowances - deductions,
    allowances,
    deductions,
  }
}
