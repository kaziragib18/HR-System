import type { Request, Response } from 'express'
import * as service from './timesheets.service'
import { TimesheetError } from './timesheets.service'
import { sendSuccess, sendError } from '../../utils/response'
import { UserRole } from '@hr-system/types'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type { RejectTimesheetInput, ListTimesheetsQuery } from './timesheets.schemas'

const MANAGER_ROLES = [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.DEPT_HEAD, UserRole.TEAM_LEAD]

function user(req: Request) { return (req as AuthRequest).user }
function scope(req: Request) { return (req as OfficeScopedRequest).officeScope }
function isManager(req: Request) { return MANAGER_ROLES.includes(user(req).role as UserRole) }

function handle(res: Response, err: unknown) {
  if (err instanceof TimesheetError) { sendError(res, err.message, err.status); return }
  throw err
}

export async function listMine(req: Request, res: Response) {
  try {
    const { items, meta } = await service.myTimesheets(user(req).employeeId, req.query as unknown as ListTimesheetsQuery)
    sendSuccess(res, items, meta)
  } catch (err) { handle(res, err) }
}

export async function getOne(req: Request, res: Response) {
  try {
    const ts = await service.getTimesheet(req.params.id, user(req).employeeId, isManager(req))
    sendSuccess(res, ts)
  } catch (err) { handle(res, err) }
}

export async function submit(req: Request, res: Response) {
  try {
    const ts = await service.submitTimesheet(req.params.id, user(req).employeeId)
    sendSuccess(res, ts)
  } catch (err) { handle(res, err) }
}

export async function approve(req: Request, res: Response) {
  try {
    const ts = await service.approveTimesheet(req.params.id, user(req).employeeId)
    sendSuccess(res, ts)
  } catch (err) { handle(res, err) }
}

export async function reject(req: Request, res: Response) {
  try {
    const ts = await service.rejectTimesheet(req.params.id, user(req).employeeId, req.body as RejectTimesheetInput)
    sendSuccess(res, ts)
  } catch (err) { handle(res, err) }
}

export async function listAll(req: Request, res: Response) {
  try {
    const { items, meta } = await service.listTimesheets(scope(req), req.query as unknown as ListTimesheetsQuery)
    sendSuccess(res, items, meta)
  } catch (err) { handle(res, err) }
}

export async function generate(req: Request, res: Response) {
  try {
    const ts = await service.generateFromAttendance(user(req).employeeId, new Date())
    sendSuccess(res, ts)
  } catch (err) { handle(res, err) }
}
