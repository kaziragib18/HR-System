import type { Request, Response } from 'express'
import * as service from './announcements.service'
import { AnnouncementError } from './announcements.service'
import { sendSuccess, sendCreated, sendError, sendUnexpectedError } from '../../utils/response'
import { auditFromRequest } from '../../utils/audit'
import { AuditAction } from '@hr-system/types'
import { isAllowedImageOrPdf, ALLOWED_UPLOAD_MESSAGE } from '../../utils/upload'
import { BUCKETS, uploadFile } from '../../services/storage.service'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type { CreateAnnouncementInput, UpdateAnnouncementInput } from './announcements.schemas'

function scope(req: Request): string | undefined {
  return (req as OfficeScopedRequest).officeScope
}

function handle(res: Response, err: unknown) {
  if (err instanceof AnnouncementError) {
    sendError(res, err.message, err.status)
    return
  }
  sendUnexpectedError(res, err)
}

export async function getFeed(req: Request, res: Response) {
  try {
    sendSuccess(res, await service.getFeed(scope(req)))
  } catch (err) {
    handle(res, err)
  }
}

export async function create(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    const body = req.body as CreateAnnouncementInput

    if (req.file && !isAllowedImageOrPdf(req.file.mimetype)) {
      sendError(res, ALLOWED_UPLOAD_MESSAGE, 400)
      return
    }

    let announcement = await service.createAnnouncement(body, authReq.user)

    if (req.file) {
      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `announcements/${announcement.id}/${Date.now()}_${safeName}`
      await uploadFile(BUCKETS.DOCUMENTS, storagePath, req.file.buffer, req.file.mimetype)
      announcement = await service.attachFile(announcement.id, storagePath)
    }

    await auditFromRequest(authReq, AuditAction.CREATE, 'Announcement', announcement.id, undefined, announcement)
    sendCreated(res, announcement)
  } catch (err) {
    handle(res, err)
  }
}

export async function update(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    const announcement = await service.updateAnnouncement(
      req.params.id,
      req.body as UpdateAnnouncementInput,
      authReq.user
    )
    await auditFromRequest(authReq, AuditAction.UPDATE, 'Announcement', announcement.id, undefined, req.body)
    sendSuccess(res, announcement)
  } catch (err) {
    handle(res, err)
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    await service.deleteAnnouncement(req.params.id, authReq.user)
    await auditFromRequest(authReq, AuditAction.DELETE, 'Announcement', req.params.id)
    sendSuccess(res, { message: 'Announcement deleted' })
  } catch (err) {
    handle(res, err)
  }
}
