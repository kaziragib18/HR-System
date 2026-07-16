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

import { getFeed, updateAnnouncement } from './announcements.service'
import { prisma } from '../../config/prisma'
import { AnnouncementCategory, UserRole } from '@hr-system/types'
import type { AccessTokenPayload } from '../../utils/jwt'

const announcementFindMany = prisma.announcement.findMany as ReturnType<typeof vi.fn>
const announcementFindUnique = prisma.announcement.findUnique as ReturnType<typeof vi.fn>
const announcementUpdate = prisma.announcement.update as ReturnType<typeof vi.fn>
const employeeFindMany = prisma.employee.findMany as ReturnType<typeof vi.fn>
const holidayFindMany = prisma.publicHoliday.findMany as ReturnType<typeof vi.fn>
const complianceDocFindMany = prisma.complianceDoc.findMany as ReturnType<typeof vi.fn>

function actor(role: UserRole, employeeId: string): AccessTokenPayload {
  return {
    sub: `user-${employeeId}`,
    employeeId,
    email: `${employeeId}@test.com`,
    role,
    officeId: 'office-bd',
    officeCode: 'BD',
  }
}

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

  it('surfaces a new joinee row with department, role, avatar, and a warm-welcome body', async () => {
    employeeFindMany
      .mockResolvedValueOnce([
        {
          id: 'emp-new',
          firstName: 'Nadia',
          lastName: 'Islam',
          joiningDate: new Date('2026-07-10'),
          officeId: 'office-bd',
          avatarUrl: 'https://cdn/avatars/nadia.png',
          department: { name: 'Accounts' },
          jobTitle: { name: 'Accountant' },
        },
      ])
      .mockResolvedValueOnce([])

    const feed = await getFeed('office-bd')
    const joinees = feed.filter((f) => f.category === AnnouncementCategory.NEW_JOINEE)

    expect(joinees).toHaveLength(1)
    expect(joinees[0].title).toContain('Nadia')
    expect(joinees[0].avatarUrl).toBe('https://cdn/avatars/nadia.png')
    expect(joinees[0].body).toContain('Accounts')
    expect(joinees[0].body).toContain('Accountant')
    expect(joinees[0].body).toContain('warm welcome')
  })

  it('falls back to a generic welcome when a new joinee has no department/role/avatar', async () => {
    employeeFindMany
      .mockResolvedValueOnce([
        { id: 'emp-new', firstName: 'Sam', lastName: 'Lee', joiningDate: new Date('2026-07-10'), officeId: 'office-bd', avatarUrl: null, department: null, jobTitle: null },
      ])
      .mockResolvedValueOnce([])

    const feed = await getFeed('office-bd')
    const joinee = feed.find((f) => f.category === AnnouncementCategory.NEW_JOINEE)!

    expect(joinee.avatarUrl).toBeNull()
    expect(joinee.body).toContain('recently joined the team')
    expect(joinee.body).toContain('warm welcome')
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

  it('shows a SUPER_ADMIN (undefined scope) every announcement regardless of officeId — no office filter applied', async () => {
    await getFeed(undefined)
    const where = announcementFindMany.mock.calls[0][0].where
    // The AND's office clause must NOT constrain officeId for an unscoped
    // (SUPER_ADMIN) read — otherwise office-scoped posts silently vanish from
    // the admin's own feed even though they were created successfully.
    const officeClause = where.AND[0]
    expect(officeClause).toEqual({})
  })

  it('scopes an office-bound reader to their office + all-offices posts only', async () => {
    await getFeed('office-bd')
    const where = announcementFindMany.mock.calls[0][0].where
    expect(where.AND[0]).toEqual({ OR: [{ officeId: null }, { officeId: 'office-bd' }] })
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

describe('updateAnnouncement', () => {
  beforeEach(() => {
    announcementFindUnique.mockResolvedValue({ id: 'ann-1', authorId: 'emp-hr', officeId: 'office-bd' })
    announcementUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'ann-1', ...data }))
  })

  it('updates title/body/category/expiresAt for the author', async () => {
    await updateAnnouncement(
      'ann-1',
      { title: 'New title', body: 'New body', category: AnnouncementCategory.OFFICE_CLOSURE, expiresAt: '2026-08-01' },
      actor(UserRole.HR_MANAGER, 'emp-hr')
    )
    const data = announcementUpdate.mock.calls[0][0].data
    expect(data).toMatchObject({ title: 'New title', body: 'New body', category: AnnouncementCategory.OFFICE_CLOSURE })
    expect(data.expiresAt).toBeInstanceOf(Date)
  })

  it('clears the expiry when expiresAt is null', async () => {
    await updateAnnouncement('ann-1', { expiresAt: null }, actor(UserRole.HR_MANAGER, 'emp-hr'))
    expect(announcementUpdate.mock.calls[0][0].data.expiresAt).toBeNull()
  })

  it('lets a SUPER_ADMIN re-scope the office (including to null = all offices)', async () => {
    await updateAnnouncement('ann-1', { officeId: null }, actor(UserRole.SUPER_ADMIN, 'emp-admin'))
    expect(announcementUpdate.mock.calls[0][0].data).toHaveProperty('officeId', null)

    announcementUpdate.mockClear()
    await updateAnnouncement('ann-1', { officeId: 'office-uk' }, actor(UserRole.SUPER_ADMIN, 'emp-admin'))
    expect(announcementUpdate.mock.calls[0][0].data).toHaveProperty('officeId', 'office-uk')
  })

  it('ignores an officeId re-scope from a non-SUPER_ADMIN author', async () => {
    await updateAnnouncement('ann-1', { officeId: 'office-uk' }, actor(UserRole.HR_MANAGER, 'emp-hr'))
    expect(announcementUpdate.mock.calls[0][0].data).not.toHaveProperty('officeId')
  })

  it('rejects a non-author, non-SUPER_ADMIN editor', async () => {
    await expect(
      updateAnnouncement('ann-1', { title: 'x' }, actor(UserRole.HR_MANAGER, 'emp-someone-else'))
    ).rejects.toMatchObject({ status: 403 })
  })
})
