import { describe, it, expect, vi, beforeEach } from 'vitest'

const { departmentFindFirst, departmentFindUnique, departmentCreate, departmentUpdate } = vi.hoisted(() => ({
  departmentFindFirst: vi.fn(async (): Promise<{ id: string; code: string; officeId: string } | null> => null),
  departmentFindUnique: vi.fn(async () => ({
    id: 'dept-1', code: 'ACC', officeId: 'office-bd',
    office: { id: 'office-bd', code: 'BD', name: 'BD' },
    manager: null,
    _count: { employees: 0 },
  } as { id: string; code: string; officeId: string; office: { id: string; code: string; name: string }; manager: null; _count: { employees: number } } | null)),
  departmentCreate: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'dept-new', ...args.data })),
  departmentUpdate: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({ id: args.where.id, ...args.data })),
}))

vi.mock('../../config/prisma', () => ({
  prisma: {
    department: {
      findFirst: departmentFindFirst,
      findUnique: departmentFindUnique,
      create: departmentCreate,
      update: departmentUpdate,
    },
  },
}))

import { createDepartment, updateDepartment, DepartmentError } from './departments.service'

beforeEach(() => {
  vi.clearAllMocks()
  departmentFindFirst.mockResolvedValue(null)
  departmentFindUnique.mockResolvedValue({
    id: 'dept-1', code: 'ACC', officeId: 'office-bd',
    office: { id: 'office-bd', code: 'BD', name: 'BD' },
    manager: null,
    _count: { employees: 0 },
  })
})

describe('createDepartment — per-office code uniqueness', () => {
  it('allows the same code in a different office', async () => {
    departmentFindFirst.mockResolvedValue(null)
    await createDepartment({ name: 'Accounts', code: 'ACC', officeId: 'office-uk' })
    expect(departmentFindFirst).toHaveBeenCalledWith({ where: { officeId: 'office-uk', code: 'ACC' } })
    expect(departmentCreate).toHaveBeenCalled()
  })

  it('rejects a duplicate code within the same office', async () => {
    departmentFindFirst.mockResolvedValue({ id: 'existing', code: 'ACC', officeId: 'office-bd' })
    await expect(createDepartment({ name: 'Accounts 2', code: 'ACC', officeId: 'office-bd' })).rejects.toMatchObject({ status: 409 })
    expect(departmentCreate).not.toHaveBeenCalled()
  })
})

describe('updateDepartment — per-office code uniqueness on rename', () => {
  it('allows renaming to a code already used by a different office', async () => {
    departmentFindFirst.mockResolvedValue(null)
    await updateDepartment('dept-1', undefined, { code: 'ACC2' })
    expect(departmentFindFirst).toHaveBeenCalledWith({
      where: { officeId: 'office-bd', code: 'ACC2', id: { not: 'dept-1' } },
    })
    expect(departmentUpdate).toHaveBeenCalled()
  })

  it('rejects renaming into a collision within the same office', async () => {
    departmentFindFirst.mockResolvedValue({ id: 'other-dept', code: 'FIN', officeId: 'office-bd' })
    await expect(updateDepartment('dept-1', undefined, { code: 'FIN' })).rejects.toMatchObject({ status: 409 })
    expect(departmentUpdate).not.toHaveBeenCalled()
  })

  it('does not check for a conflict when code is not part of the update', async () => {
    await updateDepartment('dept-1', undefined, { name: 'Renamed Accounts' })
    expect(departmentFindFirst).not.toHaveBeenCalled()
    expect(departmentUpdate).toHaveBeenCalledWith({ where: { id: 'dept-1' }, data: { name: 'Renamed Accounts' } })
  })

  it('404s via getDepartment if the target department does not exist', async () => {
    departmentFindUnique.mockResolvedValue(null)
    await expect(updateDepartment('missing', undefined, { code: 'X' })).rejects.toBeInstanceOf(DepartmentError)
    expect(departmentUpdate).not.toHaveBeenCalled()
  })
})
