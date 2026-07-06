import type { Request, Response } from 'express'
import * as service from './salary.service'
import { SalaryError } from './salary.service'
import { sendSuccess, sendCreated, sendError } from '../../utils/response'
import { auditFromRequest } from '../../utils/audit'
import { AuditAction } from '@hr-system/types'
import { prisma } from '../../config/prisma'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type { CreateSalaryStructureInput, ListSalaryQuery } from './salary.schemas'

function handle(res: Response, err: unknown) {
  if (err instanceof SalaryError) { sendError(res, err.message, err.status); return }
  throw err
}

export async function create(req: Request, res: Response) {
  try {
    const result = await service.createSalaryStructure(req.body as CreateSalaryStructureInput)
    await auditFromRequest(req as AuthRequest, AuditAction.CREATE, 'SalaryStructure', result.id, undefined, req.body)
    sendCreated(res, result)
  } catch (err) { handle(res, err) }
}

export async function list(req: Request, res: Response) {
  try {
    const { items, meta } = await service.listSalaryStructures(req.query as unknown as ListSalaryQuery)
    sendSuccess(res, items, meta)
  } catch (err) { handle(res, err) }
}

export async function getForEmployee(req: Request, res: Response) {
  try {
    const employeeId = req.params.employeeId
    const authReq = req as AuthRequest
    // Employees can only view their own salary
    if (authReq.user.role === 'EMPLOYEE' && authReq.user.employeeId !== employeeId) {
      sendError(res, 'Forbidden', 403); return
    }
    const officeScope = (req as OfficeScopedRequest).officeScope
    if (officeScope) {
      const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { officeId: true } })
      if (!emp || emp.officeId !== officeScope) { sendError(res, 'Employee not found', 404); return }
    }
    const result = await service.getEmployeeSalary(employeeId)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}
