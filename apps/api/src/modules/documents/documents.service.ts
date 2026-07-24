import { prisma } from '../../config/prisma'
import { BUCKETS, uploadFile, createSignedReadUrl } from '../../services/storage.service'
import { sanitizeFilename } from '../../utils/upload'
import type { ListDocumentsQuery } from './documents.schemas'

export class DocumentError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

interface UploadDocumentParams {
  employeeId: string
  type: string
  name: string
  buffer: Buffer
  mimeType: string
  sizeBytes: number
  uploadedById: string
  requiresSignature?: boolean
}

/**
 * Uploads a file to the documents bucket and creates the Document row.
 * Reused in-process (not over HTTP) by employees/profile.service.ts when a
 * certification/identification create or update includes a file.
 */
export async function uploadDocument(params: UploadDocumentParams) {
  const safeName = sanitizeFilename(params.name)
  const storagePath = `documents/${params.employeeId}/${params.type.toLowerCase()}/${Date.now()}_${safeName}`

  await uploadFile(BUCKETS.DOCUMENTS, storagePath, params.buffer, params.mimeType)

  return prisma.document.create({
    data: {
      employeeId: params.employeeId,
      type: params.type,
      name: params.name,
      storagePath,
      fileMime: params.mimeType,
      fileSizeBytes: params.sizeBytes,
      uploadedById: params.uploadedById,
      requiresSignature: params.requiresSignature ?? false,
    },
  })
}

export async function listDocuments(query: ListDocumentsQuery) {
  return prisma.document.findMany({
    where: {
      isActive: true,
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.type ? { type: query.type } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getDocumentById(id: string) {
  const doc = await prisma.document.findUnique({ where: { id } })
  if (!doc || !doc.isActive) throw new DocumentError('Document not found', 404)
  return doc
}

export async function getDownloadUrl(storagePath: string) {
  return createSignedReadUrl(BUCKETS.DOCUMENTS, storagePath)
}

/** Soft delete — never hard-delete, avoids dangling Certification/Identification FKs. */
export async function deactivateDocument(id: string) {
  return prisma.document.update({ where: { id }, data: { isActive: false } })
}
