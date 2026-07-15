import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../config/prisma', () => ({
  prisma: {
    office: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'office-bd' ? { code: 'BD' } : { code: 'UK' }
      ),
    },
    attendance: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async ({ create }: { create: any }) => ({ id: 'att-1', ...create })),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => ({ id: where.id, ...data })),
    },
    publicHoliday: { count: vi.fn(async () => 0) },
    leaveApplication: { count: vi.fn(async () => 0) },
  },
}))

import { selfCheckIn } from './attendance.service'
import { prisma } from '../../config/prisma'

const attendanceUpsert = prisma.attendance.upsert as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  attendanceUpsert.mockImplementation(async ({ create }: { create: any }) => ({ id: 'att-1', ...create }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('selfCheckIn', () => {
  it("stores the UK office's real local wall-clock time (BST, UTC+1), not the true UTC instant", async () => {
    // True UTC instant 07:30 -> UK local (BST, summer) is 08:30, exactly the
    // "current time 8:30 but check-in shows 7:30" bug report.
    vi.setSystemTime(new Date('2026-07-15T07:30:00.000Z'))

    await selfCheckIn('emp-uk', 'office-uk', undefined)

    const stored = attendanceUpsert.mock.calls[0][0].create.checkIn as Date
    expect(stored.getUTCHours()).toBe(8)
    expect(stored.getUTCMinutes()).toBe(30)
  })

  it("stores the BD office's real local wall-clock time (UTC+6), not the true UTC instant", async () => {
    // True UTC instant 07:30 -> BD local (UTC+6) is 13:30.
    vi.setSystemTime(new Date('2026-07-15T07:30:00.000Z'))

    await selfCheckIn('emp-bd', 'office-bd', undefined)

    const stored = attendanceUpsert.mock.calls[0][0].create.checkIn as Date
    expect(stored.getUTCHours()).toBe(13)
    expect(stored.getUTCMinutes()).toBe(30)
  })
})
