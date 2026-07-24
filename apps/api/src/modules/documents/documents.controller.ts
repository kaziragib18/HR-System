import type { Request, Response } from 'express'
import multer from 'multer'
import { AuditAction, UserRole } from '@hr-system/types'
import * as service from './documents.service'
import { DocumentError } from './documents.service'
import { sendSuccess, sendCreated, sendError, sendForbidden, sendUnexpectedError } from '../../utils/response'
import { isSelfOrRole } from '../../middleware/rbac.middleware'
import { isAllowedImageOrPdf, matchesFileSignature, ALLOWED_UPLOAD_MESSAGE } from '../../utils/upload'
import { auditFromRequest } from '../../utils/audit'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { CreateDocumentBody, ListDocumentsQuery } from './documents.schemas'

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

function handle(res: Response, err: unknown) {
  if (err instanceof DocumentError) {
    sendError(res, err.message, err.status)
    return
  }
  sendUnexpectedError(res, err)
}

export async function list(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    const query = req.query as unknown as ListDocumentsQuery
    const employeeId = query.employeeId || authReq.user.employeeId
    if (!isSelfOrRole(authReq.user, employeeId, UserRole.HR_MANAGER)) {
      sendForbidden(res)
      return
    }
    const docs = await service.listDocuments({ ...query, employeeId })
    sendSuccess(res, docs)
  } catch (err) {
    handle(res, err)
  }
}

export async function create(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    const body = req.body as CreateDocumentBody
    if (!isSelfOrRole(authReq.user, body.employeeId, UserRole.HR_MANAGER)) {
      sendForbidden(res)
      return
    }
    if (!req.file) {
      sendError(res, 'file is required', 400)
      return
    }
    if (!isAllowedImageOrPdf(req.file.mimetype) || !matchesFileSignature(req.file.mimetype, req.file.buffer)) {
      sendError(res, ALLOWED_UPLOAD_MESSAGE, 400)
      return
    }
    const doc = await service.uploadDocument({
      employeeId: body.employeeId,
      type: body.type,
      name: body.name,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploadedById: authReq.user.employeeId,
      requiresSignature: body.requiresSignature,
    })
    await auditFromRequest(authReq, AuditAction.CREATE, 'Document', doc.id, undefined, { name: doc.name, type: doc.type, employeeId: doc.employeeId })
    sendCreated(res, doc)
  } catch (err) {
    handle(res, err)
  }
}

export async function downloadUrl(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    const doc = await service.getDocumentById(req.params.id)
    if (!isSelfOrRole(authReq.user, doc.employeeId, UserRole.HR_MANAGER)) {
      sendForbidden(res)
      return
    }
    const url = await service.getDownloadUrl(doc.storagePath)
    sendSuccess(res, { downloadUrl: url, name: doc.name })
  } catch (err) {
    handle(res, err)
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    const doc = await service.getDocumentById(req.params.id)
    if (!isSelfOrRole(authReq.user, doc.employeeId, UserRole.HR_MANAGER)) {
      sendForbidden(res)
      return
    }
    await service.deactivateDocument(doc.id)
    await auditFromRequest(authReq, AuditAction.DELETE, 'Document', doc.id, { name: doc.name, type: doc.type, employeeId: doc.employeeId })
    sendSuccess(res, { message: 'Document removed' })
  } catch (err) {
    handle(res, err)
  }
}
