import type { Request, Response } from 'express'
import * as service from './leave.service'
import { LeaveError } from './leave.service'
import { sendSuccess, sendCreated, sendError, sendUnexpectedError } from '../../utils/response'
import { auditFromRequest } from '../../utils/audit'
import { AuditAction, UserRole } from '@hr-system/types'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type { ApplyLeaveInput, ApproveLeaveInput, RejectLeaveInput, LeaveApplicationsQuery, RejectCancelLeaveInput, UpdateCancelReasonInput } from './leave.schemas'
import { prisma } from '../../config/prisma'
import { supabase } from '../../config/supabase'

const MANAGER_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.DEPT_HEAD, UserRole.DEPT_MANAGER]

function user(req: Request) { return (req as AuthRequest).user }
function scope(req: Request) { return (req as OfficeScopedRequest).officeScope }
function isManager(req: Request) { return MANAGER_ROLES.includes(user(req).role) }

function handle(res: Response, err: unknown) {
  if (err instanceof LeaveError) { sendError(res, err.message, err.status); return }
  sendUnexpectedError(res, err)
}

export async function getTypes(req: Request, res: Response) {
  try {
    const u = user(req)
    const emp = await prisma.employee.findUnique({ where: { id: u.employeeId }, select: { officeId: true } })
    if (!emp) { sendError(res, 'Employee not found', 404); return }
    const types = await service.getLeaveTypes(emp.officeId)
    sendSuccess(res, types)
  } catch (err) { handle(res, err) }
}

export async function getBalances(req: Request, res: Response) {
  try {
    const employeeId = (req.params.employeeId ?? user(req).employeeId) as string
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const balances = await service.getLeaveBalances(employeeId, year, req.params.employeeId ? scope(req) : undefined)
    sendSuccess(res, balances)
  } catch (err) { handle(res, err) }
}

export async function apply(req: Request, res: Response) {
  try {
    const u = user(req)
    const emp = await prisma.employee.findUnique({ where: { id: u.employeeId }, select: { officeId: true } })
    if (!emp) { sendError(res, 'Employee not found', 404); return }
    const app = await service.applyLeave(u.employeeId, emp.officeId, u.role, req.body as ApplyLeaveInput)
    sendCreated(res, app)
  } catch (err) { handle(res, err) }
}

export async function getApplications(req: Request, res: Response) {
  try {
    const u = user(req)
    const selfOnly = !isManager(req) || req.query.self === 'true'
    const { items, meta } = await service.listApplications(u.employeeId, scope(req), selfOnly, req.query as unknown as LeaveApplicationsQuery)
    sendSuccess(res, items, meta)
  } catch (err) { handle(res, err) }
}

export async function getApplication(req: Request, res: Response) {
  try {
    const app = await service.getApplication(req.params.id, user(req).employeeId, isManager(req), scope(req))
    sendSuccess(res, app)
  } catch (err) { handle(res, err) }
}

export async function getPending(req: Request, res: Response) {
  try {
    const u = user(req)
    const isAdmin = u.role === UserRole.SUPER_ADMIN || u.role === UserRole.HR_MANAGER
    const apps = await service.pendingForApprover(u.employeeId, isAdmin, scope(req))
    sendSuccess(res, apps)
  } catch (err) { handle(res, err) }
}

export async function approve(req: Request, res: Response) {
  try {
    const u = user(req)
    const result = await service.approveLeave(req.params.id, u.employeeId, u.role, req.body as ApproveLeaveInput)
    await auditFromRequest(req as AuthRequest, AuditAction.APPROVE, 'LeaveApplication', req.params.id)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function reject(req: Request, res: Response) {
  try {
    const u = user(req)
    const result = await service.rejectLeave(req.params.id, u.employeeId, u.role, req.body as RejectLeaveInput)
    await auditFromRequest(req as AuthRequest, AuditAction.REJECT, 'LeaveApplication', req.params.id, undefined, req.body)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function cancel(req: Request, res: Response) {
  try {
    const result = await service.cancelLeave(req.params.id, user(req).employeeId, req.body?.cancelReason)
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'LeaveApplication', req.params.id, undefined, { action: 'cancel' })
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function approveCancel(req: Request, res: Response) {
  try {
    const u = user(req)
    const result = await service.approveCancelLeave(req.params.id, u.employeeId, u.role)
    await auditFromRequest(req as AuthRequest, AuditAction.APPROVE, 'LeaveApplication', req.params.id, undefined, { action: 'cancel-approve' })
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function rejectCancel(req: Request, res: Response) {
  try {
    const u = user(req)
    const result = await service.rejectCancelLeave(req.params.id, u.employeeId, u.role, (req.body as RejectCancelLeaveInput).reason)
    await auditFromRequest(req as AuthRequest, AuditAction.REJECT, 'LeaveApplication', req.params.id, undefined, { action: 'cancel-reject', ...req.body })
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function updateCancelReason(req: Request, res: Response) {
  try {
    const result = await service.updateCancelReason(req.params.id, user(req).employeeId, (req.body as UpdateCancelReasonInput).cancelReason)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function uploadAttachment(req: Request, res: Response) {
  try {
    const file = (req as Request & { file?: Express.Multer.File }).file
    if (!file) { sendError(res, 'No file provided', 400); return }

    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowed.includes(file.mimetype)) {
      sendError(res, 'Only PDF and image files are allowed', 400); return
    }
    if (file.size > 5 * 1024 * 1024) {
      sendError(res, 'File size must be under 5MB', 400); return
    }

    const employeeId = user(req).employeeId
    const ext = file.originalname.split('.').pop() ?? 'bin'
    const path = `leave-attachments/${employeeId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('documents').upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    })
    if (error) { sendError(res, 'File upload failed', 500); return }

    sendSuccess(res, { path })
  } catch (err) { handle(res, err) }
}

export async function calendar(req: Request, res: Response) {
  try {
    const u = user(req)
    const emp = await prisma.employee.findUnique({ where: { id: u.employeeId }, select: { officeId: true } })
    if (!emp) { sendError(res, 'Employee not found', 404); return }
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const entries = await service.leaveCalendar(emp.officeId, month, year)
    sendSuccess(res, entries)
  } catch (err) { handle(res, err) }
}
