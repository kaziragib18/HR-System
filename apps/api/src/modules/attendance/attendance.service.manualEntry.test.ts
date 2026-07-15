import { describe, it, expect, vi, beforeEach } from 'vitest'

const EMPLOYEES: Record<string, { id: string; officeId: string; departmentId: string }> = {
  'emp-bd': { id: 'emp-bd', officeId: 'office-bd', departmentId: 'dept-own' },
  'emp-other-dept': { id: 'emp-other-dept', officeId: 'office-bd', departmentId: 'dept-other' },
}

vi.mock('../../config/prisma', () => ({
  prisma: {
    employee: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => EMPLOYEES[where.id] ?? null),
    },
    office: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => (where.id === 'office-bd' ? { code: 'BD' } : { code: 'UK' })),
    },
    publicHoliday: { count: vi.fn(async () => 0) },
    leaveApplication: { count: vi.fn(async () => 0) },
    attendance: {
      upsert: vi.fn(async ({ create }: { create: any }) => ({ id: 'att-1', ...create })),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => ({ id: where.id, ...data })),
      create: vi.fn(async ({ data }: { data: any }) => ({ id: 'att-1', ...data })),
      findUnique: vi.fn(async () => null),
    },
  },
}))

import { manualEntry, bulkImport } from './attendance.service'
import { prisma } from '../../config/prisma'

const attendanceUpsert = prisma.attendance.upsert as ReturnType<typeof vi.fn>
const attendanceCreate = prisma.attendance.create as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  attendanceUpsert.mockImplementation(async ({ create }: { create: any }) => ({ id: 'att-1', ...create }))
  attendanceCreate.mockImplementation(async ({ data }: { data: any }) => ({ id: 'att-1', ...data }))
})

describe('manualEntry', () => {
  it("resolves the employee's actual office shift instead of always defaulting to UK hours", async () => {
    // BD_SHIFT starts at 13:30. A BD employee checking in at 13:26 (before shift
    // start) must not be flagged LATE against UK_SHIFT's 09:00 start.
    await manualEntry(
      {
        employeeId: 'emp-bd',
        date: '2026-07-10', // Friday
        checkIn: '2026-07-10T13:26:00.000Z',
        checkOut: '2026-07-10T22:00:00.000Z',
      },
      'actor-1'
    )
    expect(attendanceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: 'PRESENT', lateMinutes: 0 }),
      })
    )
  })

  it('rejects a DEPT_HEAD/DEPT_MANAGER editing someone outside their own department', async () => {
    await expect(
      manualEntry(
        { employeeId: 'emp-other-dept', date: '2026-07-10', checkIn: null, checkOut: null },
        'actor-1',
        'office-bd',
        'dept-own'
      )
    ).rejects.toMatchObject({ status: 403 })
  })

  it('allows a DEPT_HEAD/DEPT_MANAGER to edit an employee in their own department', async () => {
    await manualEntry(
      {
        employeeId: 'emp-bd',
        date: '2026-07-10',
        checkIn: '2026-07-10T13:26:00.000Z',
        checkOut: '2026-07-10T22:00:00.000Z',
      },
      'actor-1',
      'office-bd',
      'dept-own'
    )
    expect(attendanceUpsert).toHaveBeenCalled()
  })

  it('is unrestricted for HR_MANAGER/SUPER_ADMIN (no departmentScope passed)', async () => {
    await manualEntry(
      { employeeId: 'emp-other-dept', date: '2026-07-10', checkIn: null, checkOut: null },
      'actor-1',
      'office-bd',
      undefined
    )
    expect(attendanceUpsert).toHaveBeenCalled()
  })
})

describe('bulkImport', () => {
  it("resolves the employee's actual office shift for each imported record", async () => {
    const result = await bulkImport({
      records: [
        {
          employeeId: 'emp-bd',
          date: '2026-07-10',
          checkIn: '2026-07-10T13:26:00.000Z',
          checkOut: '2026-07-10T22:00:00.000Z',
          source: 'BIOMETRIC',
        },
      ],
    })
    expect(result.created).toBe(1)
    expect(attendanceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PRESENT', lateMinutes: 0 }),
      })
    )
  })
})
