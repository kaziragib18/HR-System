import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import { UserRole, AnnouncementCategory } from '@hr-system/types'

// Full-pipeline regression suite for POST /announcements — exercises the real
// authenticate -> officeScope -> requireRole -> multer -> validate -> controller
// -> service chain via supertest, the same way the actual frontend request
// (multipart/form-data with an auto-generated boundary) hits the server. This
// is what would have caught the "Content-Type: multipart/form-data with no
// boundary" bug: that bug broke multer/busboy before any of these assertions
// ever got a chance to run, so every case below also guards against that
// class of regression, not just the create/office/category/upload logic.

interface AnnouncementRow {
  id: string
  officeId: string | null
  category: string
  title: string
  body: string
  attachmentPath: string | null
  authorId: string
  [key: string]: unknown
}

let createdRows: AnnouncementRow[] = []
let updateCalls: Array<{ where: { id: string }; data: Record<string, unknown> }> = []

vi.mock('../config/prisma', () => ({
  prisma: {
    announcement: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `ann-${createdRows.length + 1}`,
          attachmentPath: null,
          ...data,
        } as AnnouncementRow
        createdRows.push(row)
        return row
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updateCalls.push({ where, data })
        const existing = createdRows.find((r) => r.id === where.id)
        const updated = { ...existing, ...data } as AnnouncementRow
        createdRows = createdRows.map((r) => (r.id === where.id ? updated : r))
        return updated
      }),
    },
    auditLog: {
      create: vi.fn(async () => ({})),
    },
  },
}))

vi.mock('../services/storage.service', async () => {
  const actual = await vi.importActual<typeof import('../services/storage.service')>(
    '../services/storage.service'
  )
  return { ...actual, uploadFile: vi.fn(async () => {}) }
})

let app: import('express').Express
let signAccessToken: typeof import('../utils/jwt').signAccessToken
let uploadFileMock: ReturnType<typeof vi.fn>

beforeAll(async () => {
  const { createApp } = await import('../app')
  ;({ signAccessToken } = await import('../utils/jwt'))
  const storage = await import('../services/storage.service')
  uploadFileMock = storage.uploadFile as unknown as ReturnType<typeof vi.fn>
  app = createApp()
})

beforeEach(() => {
  createdRows = []
  updateCalls = []
  vi.clearAllMocks()
})

function tokenFor(role: UserRole, officeId: string, employeeId: string) {
  return signAccessToken({
    id: `user-${employeeId}`,
    employeeId,
    email: `${employeeId}@test.com`,
    role,
    officeId,
    officeCode: officeId === 'office-bd' ? 'BD' : 'UK',
    officeWorkStartTime: '09:00',
    officeWorkEndTime: '17:00',
    firstName: 'Test',
    lastName: 'User',
    theme: 'light',
  })
}

describe('POST /announcements — category', () => {
  it.each(['GENERAL', 'OFFICE_CLOSURE', 'OTHER'] as const)(
    'creates a %s announcement for SUPER_ADMIN',
    async (category) => {
      const token = tokenFor(UserRole.SUPER_ADMIN, 'office-bd', 'emp-admin')
      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${token}`)
        .field('title', `Test ${category}`)
        .field('body', 'Body text')
        .field('category', category)

      expect(res.status).toBe(201)
      expect(res.body.data.category).toBe(category)
    }
  )

  it('rejects an auto-only category (BIRTHDAY) — not selectable via the manual-post endpoint', async () => {
    const token = tokenFor(UserRole.SUPER_ADMIN, 'office-bd', 'emp-admin')
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Bad category')
      .field('body', 'Body text')
      .field('category', AnnouncementCategory.BIRTHDAY)

    expect(res.status).toBe(422)
    expect(createdRows).toHaveLength(0)
  })

  it('defaults to GENERAL when category is omitted', async () => {
    const token = tokenFor(UserRole.SUPER_ADMIN, 'office-bd', 'emp-admin')
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'No category given')
      .field('body', 'Body text')

    expect(res.status).toBe(201)
    expect(res.body.data.category).toBe('GENERAL')
  })

  it('rejects a missing title/body with a readable per-field error (422)', async () => {
    const token = tokenFor(UserRole.SUPER_ADMIN, 'office-bd', 'emp-admin')
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .field('body', 'Body text only')

    expect(res.status).toBe(422)
    const fieldErrors = JSON.parse(res.body.error)
    expect(fieldErrors.title).toBeDefined()
    expect(createdRows).toHaveLength(0)
  })
})

describe('POST /announcements — office scoping', () => {
  it('SUPER_ADMIN targeting a specific office gets that officeId', async () => {
    const token = tokenFor(UserRole.SUPER_ADMIN, 'office-bd', 'emp-admin')
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'UK-only notice')
      .field('body', 'Body text')
      .field('category', 'GENERAL')
      .field('officeId', 'office-uk')

    expect(res.status).toBe(201)
    expect(res.body.data.officeId).toBe('office-uk')
  })

  it('SUPER_ADMIN omitting officeId gets null (all offices)', async () => {
    const token = tokenFor(UserRole.SUPER_ADMIN, 'office-bd', 'emp-admin')
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Company-wide notice')
      .field('body', 'Body text')
      .field('category', 'GENERAL')

    expect(res.status).toBe(201)
    expect(res.body.data.officeId).toBeNull()
  })

  it("HR_MANAGER's officeId is forced server-side, ignoring whatever the client sends", async () => {
    const token = tokenFor(UserRole.HR_MANAGER, 'office-bd', 'emp-hr')
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Trying to target another office')
      .field('body', 'Body text')
      .field('category', 'GENERAL')
      .field('officeId', 'office-uk') // should be ignored

    expect(res.status).toBe(201)
    expect(res.body.data.officeId).toBe('office-bd')
  })

  it('rejects DEPT_HEAD/DEPT_MANAGER/EMPLOYEE — only HR_MANAGER+ can post', async () => {
    for (const role of [UserRole.DEPT_HEAD, UserRole.DEPT_MANAGER, UserRole.EMPLOYEE]) {
      const token = tokenFor(role, 'office-bd', `emp-${role.toLowerCase()}`)
      const res = await request(app)
        .post('/api/v1/announcements')
        .set('Authorization', `Bearer ${token}`)
        .field('title', 'Should be forbidden')
        .field('body', 'Body text')
        .field('category', 'GENERAL')

      expect(res.status).toBe(403)
    }
    expect(createdRows).toHaveLength(0)
  })
})

describe('POST /announcements — attachment upload', () => {
  it('creates the announcement without calling uploadFile when no attachment is sent', async () => {
    const token = tokenFor(UserRole.SUPER_ADMIN, 'office-bd', 'emp-admin')
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'No attachment')
      .field('body', 'Body text')
      .field('category', 'GENERAL')

    expect(res.status).toBe(201)
    expect(res.body.data.attachmentPath).toBeNull()
    expect(uploadFileMock).not.toHaveBeenCalled()
  })

  it('uploads a valid image attachment and stores its path', async () => {
    const token = tokenFor(UserRole.SUPER_ADMIN, 'office-bd', 'emp-admin')
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'With image')
      .field('body', 'Body text')
      .field('category', 'GENERAL')
      .attach(
        'attachment',
        Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('fake-png-bytes')]),
        { filename: 'photo.png', contentType: 'image/png' }
      )

    expect(res.status).toBe(201)
    expect(uploadFileMock).toHaveBeenCalledTimes(1)
    expect(res.body.data.attachmentPath).toEqual(expect.stringContaining('announcements/'))
    expect(updateCalls).toHaveLength(1) // attachFile's prisma.announcement.update
  })

  it('rejects a disallowed attachment mimetype and does not create a row at all', async () => {
    const token = tokenFor(UserRole.SUPER_ADMIN, 'office-bd', 'emp-admin')
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Bad attachment')
      .field('body', 'Body text')
      .field('category', 'GENERAL')
      .attach('attachment', Buffer.from('not an allowed type'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/only pdf and image files/i)
    expect(createdRows).toHaveLength(0)
    expect(uploadFileMock).not.toHaveBeenCalled()
  })

  it('accepts a PDF attachment', async () => {
    const token = tokenFor(UserRole.SUPER_ADMIN, 'office-bd', 'emp-admin')
    const res = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'With PDF')
      .field('body', 'Body text')
      .field('category', 'GENERAL')
      .attach('attachment', Buffer.from('%PDF-1.4 fake'), { filename: 'policy.pdf', contentType: 'application/pdf' })

    expect(res.status).toBe(201)
    expect(uploadFileMock).toHaveBeenCalledTimes(1)
  })
})
