import { z } from 'zod'
import { AnnouncementCategory, MANUAL_ANNOUNCEMENT_CATEGORIES } from '@hr-system/types'

const manualCategory = z.nativeEnum(AnnouncementCategory).refine(
  (v) => (MANUAL_ANNOUNCEMENT_CATEGORIES as readonly AnnouncementCategory[]).includes(v),
  { message: 'category must be one of GENERAL, OFFICE_CLOSURE, OTHER' }
)

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  category: manualCategory.default(AnnouncementCategory.GENERAL),
  officeId: z.string().optional(),
  expiresAt: z.string().optional(),
})

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).optional(),
  category: manualCategory.optional(),
  expiresAt: z.string().nullable().optional(),
  // Re-scoping is SUPER_ADMIN-only, enforced in the service. null = all offices.
  officeId: z.string().nullable().optional(),
})

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>
