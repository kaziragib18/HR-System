import { prisma } from '../../config/prisma'
import { isSelfOrRole } from '../../middleware/rbac.middleware'
import { AnnouncementCategory, UserRole } from '@hr-system/types'
import type { AnnouncementFeedItem } from '@hr-system/types'
import type { AccessTokenPayload } from '../../utils/jwt'
import type { CreateAnnouncementInput, UpdateAnnouncementInput } from './announcements.schemas'

export class AnnouncementError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

const NEW_JOINEE_WINDOW_DAYS = 7
const POLICY_DOC_WINDOW_DAYS = 7
const UPCOMING_HOLIDAY_WINDOW_DAYS = 14

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

function daysAhead(n: number): Date {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

function sameMonthDay(a: Date, b: Date): boolean {
  return a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
}

export async function createAnnouncement(data: CreateAnnouncementInput, actor: AccessTokenPayload) {
  const officeId = actor.role === UserRole.SUPER_ADMIN ? (data.officeId ?? null) : actor.officeId
  return prisma.announcement.create({
    data: {
      officeId,
      category: data.category,
      title: data.title,
      body: data.body,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      authorId: actor.employeeId,
    },
  })
}

export async function attachFile(id: string, storagePath: string) {
  return prisma.announcement.update({ where: { id }, data: { attachmentPath: storagePath } })
}

async function getAnnouncementOr404(id: string) {
  const announcement = await prisma.announcement.findUnique({ where: { id } })
  if (!announcement) throw new AnnouncementError('Announcement not found', 404)
  return announcement
}

export async function updateAnnouncement(
  id: string,
  data: UpdateAnnouncementInput,
  actor: AccessTokenPayload
) {
  const existing = await getAnnouncementOr404(id)
  if (!isSelfOrRole(actor, existing.authorId, UserRole.SUPER_ADMIN)) {
    throw new AnnouncementError('Only the author or a Super Admin can edit this announcement', 403)
  }
  return prisma.announcement.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.expiresAt !== undefined
        ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }
        : {}),
    },
  })
}

export async function deleteAnnouncement(id: string, actor: AccessTokenPayload): Promise<void> {
  const existing = await getAnnouncementOr404(id)
  if (!isSelfOrRole(actor, existing.authorId, UserRole.SUPER_ADMIN)) {
    throw new AnnouncementError('Only the author or a Super Admin can delete this announcement', 403)
  }
  await prisma.announcement.delete({ where: { id } })
}

export async function getFeed(officeScope: string | undefined): Promise<AnnouncementFeedItem[]> {
  const now = new Date()

  const manualRows = await prisma.announcement.findMany({
    where: {
      AND: [
        { OR: [{ officeId: null }, ...(officeScope ? [{ officeId: officeScope }] : [])] },
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
      ],
    },
    include: { author: { select: { firstName: true, lastName: true } } },
    orderBy: { publishedAt: 'desc' },
  })

  const manual: AnnouncementFeedItem[] = manualRows.map((a) => ({
    id: a.id,
    source: 'MANUAL',
    category: a.category as AnnouncementCategory,
    title: a.title,
    body: a.body,
    officeId: a.officeId,
    attachmentPath: a.attachmentPath,
    authorName: `${a.author.firstName} ${a.author.lastName}`,
    authorId: a.authorId,
    publishedAt: a.publishedAt.toISOString(),
    expiresAt: a.expiresAt?.toISOString() ?? null,
  }))

  const employeeOfficeFilter = officeScope ? { officeId: officeScope } : {}

  const [newJoinees, employeesWithBirthOrJoinDate, holidays, policyDocs] = await Promise.all([
    prisma.employee.findMany({
      where: {
        ...employeeOfficeFilter,
        joiningDate: { gte: daysAgo(NEW_JOINEE_WINDOW_DAYS) },
        employmentStatus: { not: 'TERMINATED' },
      },
      select: { id: true, firstName: true, lastName: true, joiningDate: true, officeId: true },
    }),
    prisma.employee.findMany({
      where: { ...employeeOfficeFilter, employmentStatus: { not: 'TERMINATED' } },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true, joiningDate: true, officeId: true },
    }),
    prisma.publicHoliday.findMany({
      where: { ...employeeOfficeFilter, date: { gte: now, lte: daysAhead(UPCOMING_HOLIDAY_WINDOW_DAYS) } },
      orderBy: { date: 'asc' },
    }),
    prisma.complianceDoc.findMany({
      where: { isActive: true, createdAt: { gte: daysAgo(POLICY_DOC_WINDOW_DAYS) } },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const auto: AnnouncementFeedItem[] = []
  const today = now.toISOString().slice(0, 10)

  for (const e of newJoinees) {
    auto.push({
      id: `auto-joinee-${e.id}`,
      source: 'AUTO',
      category: AnnouncementCategory.NEW_JOINEE,
      title: `Welcome ${e.firstName} ${e.lastName}!`,
      body: `${e.firstName} ${e.lastName} recently joined the team.`,
      officeId: e.officeId,
      publishedAt: e.joiningDate.toISOString(),
    })
  }

  for (const e of employeesWithBirthOrJoinDate) {
    if (e.dateOfBirth && sameMonthDay(e.dateOfBirth, now)) {
      auto.push({
        id: `auto-birthday-${e.id}-${today}`,
        source: 'AUTO',
        category: AnnouncementCategory.BIRTHDAY,
        title: `It's ${e.firstName} ${e.lastName}'s birthday!`,
        body: `Wish ${e.firstName} a happy birthday today.`,
        officeId: e.officeId,
        publishedAt: now.toISOString(),
      })
    }

    const years = now.getUTCFullYear() - e.joiningDate.getUTCFullYear()
    if (years >= 1 && sameMonthDay(e.joiningDate, now)) {
      auto.push({
        id: `auto-anniversary-${e.id}-${today}`,
        source: 'AUTO',
        category: AnnouncementCategory.WORK_ANNIVERSARY,
        title: `${e.firstName} ${e.lastName}'s ${years}-year work anniversary`,
        body: `${e.firstName} ${e.lastName} has been with the company for ${years} year${years > 1 ? 's' : ''}.`,
        officeId: e.officeId,
        publishedAt: now.toISOString(),
      })
    }
  }

  for (const h of holidays) {
    auto.push({
      id: `auto-holiday-${h.id}`,
      source: 'AUTO',
      category: AnnouncementCategory.UPCOMING_HOLIDAY,
      title: `Upcoming holiday: ${h.name}`,
      body: `${h.name} falls on ${h.date.toISOString().slice(0, 10)}.`,
      officeId: h.officeId,
      publishedAt: now.toISOString(),
      expiresAt: h.date.toISOString(),
    })
  }

  for (const d of policyDocs) {
    auto.push({
      id: `auto-policy-${d.id}`,
      source: 'AUTO',
      category: AnnouncementCategory.POLICY_DOCUMENT,
      title: `New policy document: ${d.title}`,
      body: d.description ?? `${d.title} was uploaded by ${d.uploadedBy.firstName} ${d.uploadedBy.lastName}.`,
      officeId: null,
      publishedAt: d.createdAt.toISOString(),
    })
  }

  return [...manual, ...auto].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}
