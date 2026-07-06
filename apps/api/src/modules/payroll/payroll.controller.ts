import type { Request, Response } from 'express'
import * as service from './payroll.service'
import { PayrollError } from './payroll.service'
import { sendSuccess, sendCreated, sendError } from '../../utils/response'
import { auditFromRequest } from '../../utils/audit'
import { AuditAction } from '@hr-system/types'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type { CreatePayrollRunInput, ListPayrollRunsQuery, MyPayslipsQuery } from './payroll.schemas'

function user(req: Request) { return (req as AuthRequest).user }
function scope(req: Request) { return (req as OfficeScopedRequest).officeScope }

function handle(res: Response, err: unknown) {
  if (err instanceof PayrollError) { sendError(res, err.message, err.status); return }
  throw err
}

export async function create(req: Request, res: Response) {
  try {
    const officeId = (req.body as CreatePayrollRunInput).officeId ?? user(req).officeId
    const run = await service.createRun(officeId, req.body as CreatePayrollRunInput)
    sendCreated(res, run)
  } catch (err) { handle(res, err) }
}

export async function list(req: Request, res: Response) {
  try {
    const { items, meta } = await service.listRuns(scope(req), req.query as unknown as ListPayrollRunsQuery)
    sendSuccess(res, items, meta)
  } catch (err) { handle(res, err) }
}

export async function getOne(req: Request, res: Response) {
  try {
    const run = await service.getRun(req.params.id)
    sendSuccess(res, run)
  } catch (err) { handle(res, err) }
}

export async function process(req: Request, res: Response) {
  try {
    const run = await service.processRun(req.params.id)
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'PayrollRun', req.params.id, undefined, { action: 'process' })
    sendSuccess(res, run)
  } catch (err) { handle(res, err) }
}

export async function approve(req: Request, res: Response) {
  try {
    const run = await service.approveRun(req.params.id, user(req).employeeId)
    await auditFromRequest(req as AuthRequest, AuditAction.APPROVE, 'PayrollRun', req.params.id)
    sendSuccess(res, run)
  } catch (err) { handle(res, err) }
}

export async function paid(req: Request, res: Response) {
  try {
    const run = await service.markPaid(req.params.id)
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'PayrollRun', req.params.id, undefined, { action: 'mark-paid' })
    sendSuccess(res, run)
  } catch (err) { handle(res, err) }
}

export async function listMyPayslips(req: Request, res: Response) {
  try {
    const { items, meta } = await service.myPayslips(user(req).employeeId, req.query as unknown as MyPayslipsQuery)
    sendSuccess(res, items, meta)
  } catch (err) { handle(res, err) }
}

export async function getMyPayslip(req: Request, res: Response) {
  try {
    const entry = await service.getMyPayslip(user(req).employeeId, req.params.runId)
    sendSuccess(res, entry)
  } catch (err) { handle(res, err) }
}
