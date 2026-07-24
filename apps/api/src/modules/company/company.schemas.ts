import { z } from 'zod'

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be in HH:mm format')

export const createOfficeSchema = z.object({
  code: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/, 'Use uppercase letters/numbers only, e.g. "US"'),
  name: z.string().min(1),
  country: z.string().min(1),
  currency: z.string().min(1).max(10),
  timezone: z.string().min(1),
  taxRegime: z.string().min(1).optional(),
  workStartTime: timeSchema.optional(),
  workEndTime: timeSchema.optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  showOnClock: z.boolean().optional(),
})

export const updateOfficeSchema = z.object({
  name: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  currency: z.string().min(1).max(10).optional(),
  timezone: z.string().min(1).optional(),
  taxRegime: z.string().min(1).optional(),
  workStartTime: timeSchema.optional(),
  workEndTime: timeSchema.optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  showOnClock: z.boolean().optional(),
})

export const createComplianceDocSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
})

export type CreateOfficeInput = z.infer<typeof createOfficeSchema>
export type UpdateOfficeInput = z.infer<typeof updateOfficeSchema>
export type CreateComplianceDocInput = z.infer<typeof createComplianceDocSchema>
