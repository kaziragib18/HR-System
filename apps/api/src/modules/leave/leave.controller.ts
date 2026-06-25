import type { Request, Response } from 'express'
import * as service from './leave.service'
import { LeaveError } from './leave.service'
import { sendSuccess, sendCreated, sendError } from '../../utils/response'
import { UserRole } from '@hr-system/types'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type { ApplyLeaveInput, ApproveLeaveInput, RejectLeaveInput, LeaveApplicationsQuery } from './leave.schemas'
import { prisma } from '../../config/prisma'

const MANAGER_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.DEPT_HEAD, UserRole.TEAM_LEAD]

function user(req: Request) { return (req as AuthRequest).user }
function scope(req: Request) { return (req as OfficeScopedRequest).officeScope }
function isManager(req: Request) { return MANAGER_ROLES.includes(user(req).role) }

function handle(res: Response, err: unknown) {
  if (err instanceof LeaveError) { sendError(res, err.message, err.status); return }
  throw err
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
    const balances = await service.getLeaveBalances(employeeId, year)
    sendSuccess(res, balances)
  } catch (err) { handle(res, err) }
}

export async function apply(req: Request, res: Response) {
  try {
    const u = user(req)
    const emp = await prisma.employee.findUnique({ where: { id: u.employeeId }, select: { officeId: true } })
    if (!emp) { sendError(res, 'Employee not found', 404); return }
    const app = await service.applyLeave(u.employeeId, emp.officeId, req.body as ApplyLeaveInput)
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
    const app = await service.getApplication(req.params.id, user(req).employeeId, isManager(req))
    sendSuccess(res, app)
  } catch (err) { handle(res, err) }
}

export async function getPending(req: Request, res: Response) {
  try {
    const apps = await service.pendingForApprover(user(req).employeeId)
    sendSuccess(res, apps)
  } catch (err) { handle(res, err) }
}

export async function approve(req: Request, res: Response) {
  try {
    const u = user(req)
    const result = await service.approveLeave(req.params.id, u.sub, u.employeeId, req.body as ApproveLeaveInput)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function reject(req: Request, res: Response) {
  try {
    const result = await service.rejectLeave(req.params.id, user(req).employeeId, req.body as RejectLeaveInput)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}

export async function cancel(req: Request, res: Response) {
  try {
    const result = await service.cancelLeave(req.params.id, user(req).employeeId)
    sendSuccess(res, result)
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
