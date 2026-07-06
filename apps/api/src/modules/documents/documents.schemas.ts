import { z } from 'zod'
import { DocumentType } from '@hr-system/types'

export const listDocumentsQuerySchema = z.object({
  employeeId: z.string().optional(),
  type: z.nativeEnum(DocumentType).optional(),
})

export const createDocumentBodySchema = z.object({
  employeeId: z.string().min(1),
  type: z.nativeEnum(DocumentType),
  name: z.string().min(1),
  requiresSignature: z.coerce.boolean().optional(),
})

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>
export type CreateDocumentBody = z.infer<typeof createDocumentBodySchema>
