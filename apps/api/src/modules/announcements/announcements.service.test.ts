import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../config/prisma', () => ({
  prisma: {
    announcement: {
      findMany: vi.fn(async () => []),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    employee: { findMany: vi.fn(async () => []) },
    publicHoliday: { findMany: vi.fn(async () => []) },
    complianceDoc: { findMany: vi.fn(async () => []) },
  },
}))

import { getFeed } from './announcements.service'
import { prisma } from '../../config/prisma'
import { AnnouncementCategory } from '@hr-system/types'

const announcementFindMany = prisma.announcement.findMany as ReturnType<typeof vi.fn>
const employeeFindMany = prisma.employee.findMany as ReturnType<typeof vi.fn>
const holidayFindMany = prisma.publicHoliday.findMany as ReturnType<typeof vi.fn>
const complianceDocFindMany = prisma.complianceDoc.findMany as ReturnType<typeof vi.fn>

const TODAY = '2026-07-14T00:00:00.000Z'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(TODAY))
  announcementFindMany.mockResolvedValue([])
  employeeFindMany.mockResolvedValue([])
  holidayFindMany.mockResolvedValue([])
  complianceDocFindMany.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getFeed', () => {
  it('includes a manual announcement and maps author name', async () => {
    announcementFindMany.mockResolvedValue([
      {
        id: 'ann-1',
        officeId: 'office-bd',
        category: 'GENERAL',
        title: 'Office party',
        body: 'Join us Friday',
        attachmentPath: null,
        authorId: 'emp-hr',
        author: { firstName: 'Riya', lastName: 'HR' },
        publishedAt: new Date('2026-07-13T00:00:00.000Z'),
        expiresAt: null,
      },
    ])

    const feed = await getFeed('office-bd')

    expect(feed).toHaveLength(1)
    expect(feed[0]).toMatchObject({
      id: 'ann-1',
      source: 'MANUAL',
      category: AnnouncementCategory.GENERAL,
      authorName: 'Riya HR',
    })
  })

  it('flags a birthday today but not a birthday on a different day', async () => {
    employeeFindMany
      .mockResolvedValueOnce([]) // new-joinee query
      .mockResolvedValueOnce([
        { id: 'emp-1', firstName: 'Ayesha', lastName: 'Rahman', dateOfBirth: new Date('1995-07-14'), joiningDate: new Date('2020-01-01'), officeId: 'office-bd' },
        { id: 'emp-2', firstName: 'Karim', lastName: 'Uddin', dateOfBirth: new Date('1990-03-02'), joiningDate: new Date('2021-01-01'), officeId: 'office-bd' },
      ])

    const feed = await getFeed('office-bd')
    const birthdays = feed.filter((f) => f.category === AnnouncementCategory.BIRTHDAY)

    expect(birthdays).toHaveLength(1)
    expect(birthdays[0].id).toBe('auto-birthday-emp-1-2026-07-14')
  })

  it('flags a work anniversary only when at least one full year has passed', async () => {
    employeeFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'emp-1', firstName: 'Ayesha', lastName: 'Rahman', dateOfBirth: null, joiningDate: new Date('2023-07-14'), officeId: 'office-bd' }, // 3 years
        { id: 'emp-2', firstName: 'New', lastName: 'Hire', dateOfBirth: null, joiningDate: new Date('2026-07-14'), officeId: 'office-bd' }, // joined today, 0 years
      ])

    const feed = await getFeed('office-bd')
    const anniversaries = feed.filter((f) => f.category === AnnouncementCategory.WORK_ANNIVERSARY)

    expect(anniversaries).toHaveLength(1)
    expect(anniversaries[0].title).toContain('Ayesha')
  })

  it('surfaces a new joinee row for whatever the office-scoped query returns', async () => {
    employeeFindMany
      .mockResolvedValueOnce([
        { id: 'emp-new', firstName: 'Nadia', lastName: 'Islam', joiningDate: new Date('2026-07-10'), officeId: 'office-bd' },
      ])
      .mockResolvedValueOnce([])

    const feed = await getFeed('office-bd')
    const joinees = feed.filter((f) => f.category === AnnouncementCategory.NEW_JOINEE)

    expect(joinees).toHaveLength(1)
    expect(joinees[0].title).toContain('Nadia')
  })

  it('includes an upcoming holiday and a recently uploaded policy document', async () => {
    holidayFindMany.mockResolvedValue([
      { id: 'hol-1', officeId: 'office-bd', name: 'Independence Day', date: new Date('2026-07-20'), year: 2026, isRecurring: true },
    ])
    complianceDocFindMany.mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Updated Leave Policy',
        description: 'New WFH rules',
        uploadedBy: { firstName: 'Riya', lastName: 'HR' },
        createdAt: new Date('2026-07-12T00:00:00.000Z'),
      },
    ])

    const feed = await getFeed('office-bd')

    expect(feed.some((f) => f.category === AnnouncementCategory.UPCOMING_HOLIDAY && f.title.includes('Independence Day'))).toBe(true)
    expect(feed.some((f) => f.category === AnnouncementCategory.POLICY_DOCUMENT && f.title.includes('Updated Leave Policy'))).toBe(true)
  })

  it('sorts the merged feed by publishedAt descending', async () => {
    announcementFindMany.mockResolvedValue([
      {
        id: 'ann-old',
        officeId: null,
        category: 'GENERAL',
        title: 'Old post',
        body: '...',
        attachmentPath: null,
        authorId: 'emp-hr',
        author: { firstName: 'Riya', lastName: 'HR' },
        publishedAt: new Date('2026-07-01T00:00:00.000Z'),
        expiresAt: null,
      },
    ])
    holidayFindMany.mockResolvedValue([
      { id: 'hol-1', officeId: 'office-bd', name: 'Independence Day', date: new Date('2026-07-20'), year: 2026, isRecurring: true },
    ])

    const feed = await getFeed('office-bd')

    expect(feed[0].id).toBe('auto-holiday-hol-1') // published "now" (2026-07-14), sorts above the older manual post
    expect(feed[1].id).toBe('ann-old')
  })
})
