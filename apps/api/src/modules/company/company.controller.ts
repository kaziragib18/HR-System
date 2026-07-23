import type { Request, Response } from 'express'
import * as service from './company.service'
import { OfficeError } from './company.service'
import { sendSuccess, sendCreated, sendError, sendUnexpectedError } from '../../utils/response'
import { auditFromRequest } from '../../utils/audit'
import { AuditAction, UserRole } from '@hr-system/types'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { CreateOfficeInput, UpdateOfficeInput } from './company.schemas'

function handle(res: Response, err: unknown) {
  if (err instanceof OfficeError) {
    sendError(res, err.message, err.status)
    return
  }
  sendUnexpectedError(res, err)
}

export async function list(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest
    const includeInactive = req.query.includeInactive === 'true' && authReq.user.role === UserRole.SUPER_ADMIN
    sendSuccess(res, await service.listOffices(includeInactive))
  } catch (err) {
    handle(res, err)
  }
}

export async function create(req: Request, res: Response) {
  try {
    const office = await service.createOffice(req.body as CreateOfficeInput)
    await auditFromRequest(req as AuthRequest, AuditAction.CREATE, 'Office', office.id, undefined, office)
    sendCreated(res, office)
  } catch (err) {
    handle(res, err)
  }
}

export async function update(req: Request, res: Response) {
  try {
    const office = await service.updateOffice(req.params.id, req.body as UpdateOfficeInput)
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'Office', office.id, undefined, req.body)
    sendSuccess(res, office)
  } catch (err) {
    handle(res, err)
  }
}

export async function deactivate(req: Request, res: Response) {
  try {
    const office = await service.deactivateOffice(req.params.id)
    await auditFromRequest(req as AuthRequest, AuditAction.DELETE, 'Office', req.params.id)
    sendSuccess(res, office)
  } catch (err) {
    handle(res, err)
  }
}

export async function reactivate(req: Request, res: Response) {
  try {
    const office = await service.reactivateOffice(req.params.id)
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'Office', req.params.id, undefined, { isActive: true })
    sendSuccess(res, office)
  } catch (err) {
    handle(res, err)
  }
}
