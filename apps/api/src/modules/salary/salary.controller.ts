import type { Request, Response } from 'express'
import * as service from './salary.service'
import { SalaryError } from './salary.service'
import { sendSuccess, sendCreated, sendError, sendUnexpectedError } from '../../utils/response'
import { auditFromRequest } from '../../utils/audit'
import { AuditAction, UserRole } from '@hr-system/types'
import { prisma } from '../../config/prisma'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type { CreateSalaryStructureInput, ListSalaryQuery } from './salary.schemas'

function handle(res: Response, err: unknown) {
  if (err instanceof SalaryError) { sendError(res, err.message, err.status); return }
  sendUnexpectedError(res, err)
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
    const caller = authReq.user

    // Everyone can view their own salary; every other case is checked against
    // the target employee's real office/department/reporting-chain below —
    // never trust a role alone for "can see someone else's compensation".
    if (caller.employeeId !== employeeId) {
      const target = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { officeId: true, departmentId: true, reportingToId: true },
      })
      if (!target) { sendError(res, 'Employee not found', 404); return }

      const officeScope = (req as OfficeScopedRequest).officeScope
      if (officeScope && target.officeId !== officeScope) {
        sendError(res, 'Employee not found', 404); return
      }

      // SUPER_ADMIN/HR_MANAGER can view anyone in scope; DEPT_HEAD is limited to
      // their own department (they're its top, same as the dashboard "My Team"
      // and approval-override rules); DEPT_MANAGER is limited to their direct
      // reports only; a plain EMPLOYEE can never view anyone else's.
      const canView =
        caller.role === UserRole.SUPER_ADMIN ||
        caller.role === UserRole.HR_MANAGER ||
        (caller.role === UserRole.DEPT_HEAD && target.departmentId === caller.departmentId) ||
        (caller.role === UserRole.DEPT_MANAGER && target.reportingToId === caller.employeeId)

      if (!canView) { sendError(res, 'Forbidden', 403); return }
    }

    const result = await service.getEmployeeSalary(employeeId)
    sendSuccess(res, result)
  } catch (err) { handle(res, err) }
}
