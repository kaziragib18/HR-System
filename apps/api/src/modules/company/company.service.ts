import { prisma } from '../../config/prisma'
import type { CreateOfficeInput, UpdateOfficeInput } from './company.schemas'

export class OfficeError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

export async function listOffices(includeInactive: boolean) {
  return prisma.office.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { code: 'asc' },
  })
}

export async function getOffice(id: string) {
  const office = await prisma.office.findUnique({ where: { id } })
  if (!office) throw new OfficeError('Office not found', 404)
  return office
}

export async function createOffice(data: CreateOfficeInput) {
  const existing = await prisma.office.findUnique({ where: { code: data.code } })
  if (existing) throw new OfficeError('An office with this code already exists', 409)
  return prisma.office.create({
    data: {
      code: data.code,
      name: data.name,
      country: data.country,
      currency: data.currency,
      timezone: data.timezone,
      taxRegime: data.taxRegime ?? 'UNCONFIGURED',
      workStartTime: data.workStartTime ?? '09:00',
      workEndTime: data.workEndTime ?? '17:00',
      address: data.address,
      phone: data.phone || undefined,
      email: data.email || undefined,
      website: data.website,
      showOnClock: data.showOnClock ?? true,
    },
  })
}

export async function updateOffice(id: string, data: UpdateOfficeInput) {
  await getOffice(id)
  return prisma.office.update({ where: { id }, data })
}

export async function deactivateOffice(id: string) {
  const office = await getOffice(id)

  if (office.isDefault) {
    throw new OfficeError('The default office cannot be removed', 400)
  }

  const activeCount = await prisma.employee.count({
    where: { officeId: id, employmentStatus: { not: 'TERMINATED' } },
  })
  if (activeCount > 0) {
    throw new OfficeError(
      `Cannot remove: ${activeCount} active ${activeCount === 1 ? 'employee' : 'employees'} must be transferred or offboarded first`,
      409
    )
  }

  return prisma.office.update({ where: { id }, data: { isActive: false } })
}

export async function reactivateOffice(id: string) {
  await getOffice(id)
  return prisma.office.update({ where: { id }, data: { isActive: true } })
}
