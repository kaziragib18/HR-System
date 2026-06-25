import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { hashPassword } from '../../utils/hash'
import { parsePagination, buildPaginationMeta } from '@hr-system/utils'
import { UserRole } from '@hr-system/types'
import type { CreateEmployeeInput, UpdateEmployeeInput, BankInfoInput, ListEmployeesQuery } from './employees.schemas'

export class EmployeeError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

const listInclude = {
  department: { select: { id: true, name: true } },
  jobTitle: { select: { id: true, name: true } },
  jobGrade: { select: { id: true, name: true } },
  reportingTo: { select: { id: true, firstName: true, lastName: true } },
  office: { select: { id: true, code: true, name: true } },
} satisfies Prisma.EmployeeInclude

/** Generates the next employee ID like "BD-2025-001". */
async function generateEmployeeId(officeCode: string, joiningYear: number): Promise<string> {
  const prefix = `${officeCode}-${joiningYear}-`
  const last = await prisma.employee.findFirst({
    where: { employeeId: { startsWith: prefix } },
    orderBy: { employeeId: 'desc' },
    select: { employeeId: true },
  })
  const lastSeq = last ? parseInt(last.employeeId.slice(prefix.length), 10) : 0
  return `${prefix}${String(lastSeq + 1).padStart(3, '0')}`
}

export async function listEmployees(officeScope: string | undefined, query: ListEmployeesQuery) {
  const { skip, take, page, limit } = parsePagination(query)

  const where: Prisma.EmployeeWhereInput = {
    ...(officeScope ? { officeId: officeScope } : query.officeId ? { officeId: query.officeId } : {}),
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.employmentStatus ? { employmentStatus: query.employmentStatus } : {}),
    ...(query.search
      ? {
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { employeeId: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.employee.findMany({ where, include: listInclude, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.employee.count({ where }),
  ])

  return { items, meta: buildPaginationMeta(total, page, limit) }
}

export async function getEmployee(id: string, officeScope: string | undefined) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { ...listInclude, user: { select: { role: true, isActive: true } } },
  })
  if (!employee) throw new EmployeeError('Employee not found', 404)
  if (officeScope && employee.officeId !== officeScope) throw new EmployeeError('Employee not found', 404)
  return employee
}

export async function createEmployee(data: CreateEmployeeInput, createdById: string) {
  const office = await prisma.office.findUnique({ where: { id: data.officeId } })
  if (!office) throw new EmployeeError('Office not found', 404)

  const existing = await prisma.employee.findUnique({ where: { email: data.email } })
  if (existing) throw new EmployeeError('An employee with this email already exists', 409)

  const joiningYear = new Date(data.joiningDate).getFullYear()
  const employeeId = await generateEmployeeId(office.code, joiningYear)

  // Temp password returned once so HR can share it (no email channel).
  const tempPassword = randomBytes(6).toString('base64url')
  const passwordHash = await hashPassword(tempPassword)

  const employee = await prisma.$transaction(async (tx) => {
    const emp = await tx.employee.create({
      data: {
        employeeId,
        officeId: data.officeId,
        departmentId: data.departmentId,
        jobTitleId: data.jobTitleId,
        jobGradeId: data.jobGradeId,
        reportingToId: data.reportingToId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        gender: data.gender,
        nationality: data.nationality,
        nationalId: data.nationalId,
        passportNumber: data.passportNumber,
        employmentType: data.employmentType,
        joiningDate: new Date(data.joiningDate),
        probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : undefined,
        presentAddress: data.presentAddress as Prisma.InputJsonValue | undefined,
        permanentAddress: data.permanentAddress as Prisma.InputJsonValue | undefined,
        emergencyContact: data.emergencyContact as Prisma.InputJsonValue | undefined,
        createdById,
      },
      include: listInclude,
    })

    await tx.user.create({
      data: {
        employeeId: emp.id,
        email: data.email,
        passwordHash,
        role: UserRole.EMPLOYEE,
      },
    })

    return emp
  })

  return { employee, tempPassword }
}

export async function updateEmployee(id: string, officeScope: string | undefined, data: UpdateEmployeeInput) {
  await getEmployee(id, officeScope) // existence + scope check

  const { avatarStoragePath, ...rest } = data
  const employee = await prisma.employee.update({
    where: { id },
    data: {
      ...rest,
      dateOfBirth: rest.dateOfBirth ? new Date(rest.dateOfBirth) : undefined,
      joiningDate: rest.joiningDate ? new Date(rest.joiningDate) : undefined,
      probationEndDate: rest.probationEndDate ? new Date(rest.probationEndDate) : undefined,
      confirmationDate: rest.confirmationDate ? new Date(rest.confirmationDate) : undefined,
      lastWorkingDay: rest.lastWorkingDay ? new Date(rest.lastWorkingDay) : undefined,
      presentAddress: rest.presentAddress as Prisma.InputJsonValue | undefined,
      permanentAddress: rest.permanentAddress as Prisma.InputJsonValue | undefined,
      emergencyContact: rest.emergencyContact as Prisma.InputJsonValue | undefined,
      avatarUrl: avatarStoragePath,
    },
    include: listInclude,
  })
  return employee
}

/** Soft delete — mark terminated and deactivate the login. */
export async function deactivateEmployee(id: string, officeScope: string | undefined) {
  await getEmployee(id, officeScope)
  await prisma.$transaction([
    prisma.employee.update({
      where: { id },
      data: { employmentStatus: 'TERMINATED', lastWorkingDay: new Date() },
    }),
    prisma.user.updateMany({ where: { employeeId: id }, data: { isActive: false } }),
    prisma.session.updateMany({ where: { user: { employeeId: id } }, data: { isValid: false } }),
  ])
}

export async function getBankInfo(employeeId: string, officeScope: string | undefined) {
  await getEmployee(employeeId, officeScope)
  return prisma.bankInfo.findUnique({ where: { employeeId } })
}

export async function upsertBankInfo(employeeId: string, officeScope: string | undefined, data: BankInfoInput) {
  await getEmployee(employeeId, officeScope)
  return prisma.bankInfo.upsert({
    where: { employeeId },
    create: { employeeId, ...data },
    update: data,
  })
}

export async function getDirectory(officeScope: string | undefined, search?: string) {
  return prisma.employee.findMany({
    where: {
      employmentStatus: { not: 'TERMINATED' },
      ...(officeScope ? { officeId: officeScope } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatarUrl: true,
      department: { select: { name: true } },
      jobTitle: { select: { name: true } },
    },
    orderBy: { firstName: 'asc' },
  })
}

export async function getOrgChart(id: string, officeScope: string | undefined) {
  const employee = await getEmployee(id, officeScope)
  const directReports = await prisma.employee.findMany({
    where: { reportingToId: id, employmentStatus: { not: 'TERMINATED' } },
    select: { id: true, firstName: true, lastName: true, employeeId: true, jobTitle: { select: { name: true } } },
  })

  // Walk up the reporting chain
  const chain: Array<{ id: string; firstName: string; lastName: string }> = []
  let currentId = employee.reportingToId
  const guard = new Set<string>()
  while (currentId && !guard.has(currentId)) {
    guard.add(currentId)
    const mgr = await prisma.employee.findUnique({
      where: { id: currentId },
      select: { id: true, firstName: true, lastName: true, reportingToId: true },
    })
    if (!mgr) break
    chain.push({ id: mgr.id, firstName: mgr.firstName, lastName: mgr.lastName })
    currentId = mgr.reportingToId
  }

  return { employee, reportingChain: chain, directReports }
}
