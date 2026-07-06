import { z } from 'zod'
import { SkillLevel, IdentificationType } from '@hr-system/types'

// ─── Work Experience ────────────────────────────────────────────────────────

export const createWorkExperienceSchema = z.object({
  companyName: z.string().min(1),
  jobTitle: z.string().min(1),
  location: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isCurrent: z.boolean().optional(),
  description: z.string().optional(),
})
export const updateWorkExperienceSchema = createWorkExperienceSchema.partial()

// ─── Education ──────────────────────────────────────────────────────────────

export const createEducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  fieldOfStudy: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  grade: z.string().optional(),
  description: z.string().optional(),
})
export const updateEducationSchema = createEducationSchema.partial()

// ─── Skills ─────────────────────────────────────────────────────────────────

export const createSkillSchema = z.object({
  name: z.string().min(1),
  level: z.nativeEnum(SkillLevel),
  yearsOfExperience: z.coerce.number().int().min(0).optional(),
})
export const updateSkillSchema = z.object({
  level: z.nativeEnum(SkillLevel).optional(),
  yearsOfExperience: z.coerce.number().int().min(0).optional(),
})

// ─── Certifications (Training) — multipart, file optional ──────────────────

export const createCertificationSchema = z.object({
  name: z.string().min(1),
  issuingOrganization: z.string().min(1),
  issueDate: z.string().min(1),
  expiryDate: z.string().optional(),
  credentialId: z.string().optional(),
  credentialUrl: z.string().optional(),
})
export const updateCertificationSchema = createCertificationSchema.partial()

// ─── Identification — multipart, file optional ──────────────────────────────

export const createIdentificationSchema = z.object({
  type: z.nativeEnum(IdentificationType),
  documentNumber: z.string().min(1),
  issuingAuthority: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
})
export const updateIdentificationSchema = createIdentificationSchema.partial()

export type CreateWorkExperienceInput = z.infer<typeof createWorkExperienceSchema>
export type UpdateWorkExperienceInput = z.infer<typeof updateWorkExperienceSchema>
export type CreateEducationInput = z.infer<typeof createEducationSchema>
export type UpdateEducationInput = z.infer<typeof updateEducationSchema>
export type CreateSkillInput = z.infer<typeof createSkillSchema>
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>
export type CreateCertificationInput = z.infer<typeof createCertificationSchema>
export type UpdateCertificationInput = z.infer<typeof updateCertificationSchema>
export type CreateIdentificationInput = z.infer<typeof createIdentificationSchema>
export type UpdateIdentificationInput = z.infer<typeof updateIdentificationSchema>
