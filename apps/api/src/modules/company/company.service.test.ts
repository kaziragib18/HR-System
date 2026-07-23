import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  officeFindUnique,
  officeFindUniqueByCode,
  officeUpdate,
  officeCreate,
  officeFindMany,
  employeeCount,
} = vi.hoisted(() => ({
  officeFindUnique: vi.fn(async () => ({ id: 'office-uk', code: 'UK', isDefault: false, isActive: true })),
  officeFindUniqueByCode: vi.fn(async () => null),
  officeUpdate: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({ id: args.where.id, ...args.data })),
  officeCreate: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'office-new', ...args.data })),
  officeFindMany: vi.fn(async () => []),
  employeeCount: vi.fn(async () => 0),
}))

vi.mock('../../config/prisma', () => ({
  prisma: {
    office: {
      findUnique: vi.fn((args: { where: { id?: string; code?: string } }) =>
        args.where.code !== undefined ? officeFindUniqueByCode() : officeFindUnique()
      ),
      update: officeUpdate,
      create: officeCreate,
      findMany: officeFindMany,
    },
    employee: {
      count: employeeCount,
    },
  },
}))

import { deactivateOffice, reactivateOffice, createOffice, OfficeError } from './company.service'

beforeEach(() => {
  vi.clearAllMocks()
  officeFindUnique.mockResolvedValue({ id: 'office-uk', code: 'UK', isDefault: false, isActive: true })
  officeFindUniqueByCode.mockResolvedValue(null)
  employeeCount.mockResolvedValue(0)
})

describe('deactivateOffice', () => {
  it('rejects deactivating the default office', async () => {
    officeFindUnique.mockResolvedValue({ id: 'office-bd', code: 'BD', isDefault: true, isActive: true })
    await expect(deactivateOffice('office-bd')).rejects.toMatchObject({ status: 400 })
    expect(officeUpdate).not.toHaveBeenCalled()
  })

  it('rejects deactivating an office with active employees remaining', async () => {
    employeeCount.mockResolvedValue(3)
    await expect(deactivateOffice('office-uk')).rejects.toMatchObject({ status: 409 })
    expect(officeUpdate).not.toHaveBeenCalled()
  })

  it('deactivates a non-default office with zero active employees', async () => {
    employeeCount.mockResolvedValue(0)
    const result = await deactivateOffice('office-uk')
    expect(officeUpdate).toHaveBeenCalledWith({ where: { id: 'office-uk' }, data: { isActive: false } })
    expect(result).toMatchObject({ isActive: false })
  })

  it('404s for a non-existent office', async () => {
    officeFindUnique.mockResolvedValue(null as unknown as { id: string; code: string; isDefault: boolean; isActive: boolean })
    await expect(deactivateOffice('missing')).rejects.toBeInstanceOf(OfficeError)
  })
})

describe('reactivateOffice', () => {
  it('sets isActive back to true', async () => {
    await reactivateOffice('office-uk')
    expect(officeUpdate).toHaveBeenCalledWith({ where: { id: 'office-uk' }, data: { isActive: true } })
  })
})

describe('createOffice', () => {
  it('rejects a duplicate office code', async () => {
    officeFindUniqueByCode.mockResolvedValue({ id: 'existing', code: 'US' } as unknown as null)
    await expect(
      createOffice({ code: 'US', name: 'PEN US', country: 'USA', currency: 'USD', timezone: 'America/New_York' })
    ).rejects.toMatchObject({ status: 409 })
    expect(officeCreate).not.toHaveBeenCalled()
  })

  it('creates a new office defaulting shift hours and isActive/isDefault', async () => {
    await createOffice({ code: 'US', name: 'PEN US', country: 'USA', currency: 'USD', timezone: 'America/New_York' })
    expect(officeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'US',
          workStartTime: '09:00',
          workEndTime: '17:00',
        }),
      })
    )
  })
})
