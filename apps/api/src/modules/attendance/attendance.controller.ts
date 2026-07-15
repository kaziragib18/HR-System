import type { Request, Response } from 'express'
import * as service from './attendance.service'
import { AttendanceError } from './attendance.service'
import { sendSuccess, sendCreated, sendError } from '../../utils/response'
import { auditFromRequest } from '../../utils/audit'
import { AuditAction } from '@hr-system/types'
import { prisma } from '../../config/prisma'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type { DepartmentScopedRequest } from '../../middleware/department.middleware'
import type { ManualEntryInput, BulkImportInput, ListAttendanceQuery, LateExcuseInput, ReviewExcuseInput, RequestAdjustmentInput, ReviewAdjustmentInput } from './attendance.schemas'

function user(req: Request) { return (req as AuthRequest).user }
function scope(req: Request) { return (req as OfficeScopedRequest).officeScope }
function deptScope(req: Request) { return (req as DepartmentScopedRequest).departmentScope }

function handle(res: Response, err: unknown) {
  if (err instanceof AttendanceError) { sendError(res, err.message, err.status); return }
  throw err
}

export async function checkIn(req: Request, res: Response) {
  try {
    const u = user(req)
    const employee = await import('../../config/prisma').then(m =>
      m.prisma.employee.findUnique({ where: { id: u.employeeId }, select: { officeId: true } })
    )
    if (!employee) { sendError(res, 'Employee record not found', 404); return }
    const record = await service.selfCheckIn(u.employeeId, employee.officeId, req.body?.remarks)
    sendCreated(res, record)
  } catch (err) { handle(res, err) }
}

export async function checkOut(req: Request, res: Response) {
  try {
    const u = user(req)
    const employee = await import('../../config/prisma').then(m =>
      m.prisma.employee.findUnique({ where: { id: u.employeeId }, select: { officeId: true } })
    )
    if (!employee) { sendError(res, 'Employee record not found', 404); return }
    const record = await service.selfCheckOut(u.employeeId, employee.officeId, req.body?.remarks)
    sendSuccess(res, record)
  } catch (err) { handle(res, err) }
}

export async function getToday(req: Request, res: Response) {
  try {
    const record = await service.todayAttendance(user(req).employeeId)
    sendSuccess(res, record)
  } catch (err) { handle(res, err) }
}

export async function getMyMonth(req: Request, res: Response) {
  try {
    const now = new Date()
    const month = parseInt(req.query.month as string) || now.getMonth() + 1
    const year = parseInt(req.query.year as string) || now.getFullYear()
    const records = await service.myMonthAttendance(user(req).employeeId, month, year)
    sendSuccess(res, records)
  } catch (err) { handle(res, err) }
}

export async function list(req: Request, res: Response) {
  try {
    const { items, meta } = await service.listAttendance(scope(req), deptScope(req), req.query as unknown as ListAttendanceQuery)
    sendSuccess(res, items, meta)
  } catch (err) { handle(res, err) }
}

export async function manualEntry(req: Request, res: Response) {
  try {
    const record = await service.manualEntry(req.body as ManualEntryInput, user(req).sub, scope(req), deptScope(req))
    sendCreated(res, record)
  } catch (err) { handle(res, err) }
}

export async function bulkImport(req: Request, res: Response) {
  try {
    const result = await service.bulkImport(req.body as BulkImportInput)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function getMyCalendar(req: Request, res: Response) {
  try {
    const now = new Date()
    const month = parseInt(req.query.month as string) || now.getMonth() + 1
    const year = parseInt(req.query.year as string) || now.getFullYear()
    const result = await service.myCalendar(user(req).employeeId, month, year)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function submitLateExcuse(req: Request, res: Response) {
  try {
    const u = user(req)
    const { excuse } = req.body as LateExcuseInput
    const record = await service.submitLateExcuse(req.params.id, u.employeeId, excuse)
    sendSuccess(res, record)
  } catch (err) { handle(res, err) }
}

export async function reviewExcuse(req: Request, res: Response) {
  try {
    const u = user(req)
    const { approved, newStatus } = req.body as ReviewExcuseInput
    const record = await service.reviewExcuse(req.params.id, u.employeeId, u.role, approved, scope(req), newStatus)
    sendSuccess(res, record)
  } catch (err) { handle(res, err) }
}

export async function listPendingExcuses(req: Request, res: Response) {
  try {
    const u = user(req)
    const items = await service.listPendingExcuses(scope(req), u.employeeId, u.role)
    sendSuccess(res, items)
  } catch (err) { handle(res, err) }
}

export async function requestAdjustment(req: Request, res: Response) {
  try {
    const u = user(req)
    const employee = await prisma.employee.findUnique({ where: { id: u.employeeId }, select: { officeId: true } })
    if (!employee) { sendError(res, 'Employee record not found', 404); return }
    const record = await service.requestAdjustment(u.employeeId, employee.officeId, u.role, req.body as RequestAdjustmentInput)
    await auditFromRequest(req as AuthRequest, AuditAction.CREATE, 'Attendance', record.id, undefined, req.body)
    sendCreated(res, record)
  } catch (err) { handle(res, err) }
}

export async function updateAdjustmentRequest(req: Request, res: Response) {
  try {
    const record = await service.updateAdjustmentRequest(req.params.id, user(req).employeeId, req.body as RequestAdjustmentInput)
    sendSuccess(res, record)
  } catch (err) { handle(res, err) }
}

export async function listPendingAdjustments(req: Request, res: Response) {
  try {
    const u = user(req)
    const items = await service.listPendingAdjustments(scope(req), u.employeeId, u.role)
    sendSuccess(res, items)
  } catch (err) { handle(res, err) }
}

export async function reviewAdjustment(req: Request, res: Response) {
  try {
    const u = user(req)
    const { approved, rejectionReason } = req.body as ReviewAdjustmentInput
    const result = await service.reviewAdjustment(req.params.id, u.employeeId, u.role, approved, rejectionReason, scope(req))
    await auditFromRequest(req as AuthRequest, approved ? AuditAction.APPROVE : AuditAction.REJECT, 'Attendance', req.params.id, undefined, req.body)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}
