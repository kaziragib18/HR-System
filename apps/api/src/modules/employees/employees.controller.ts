import type { Request, Response } from 'express'
import * as service from './employees.service'
import { EmployeeError } from './employees.service'
import { sendSuccess, sendCreated, sendError } from '../../utils/response'
import { auditFromRequest } from '../../utils/audit'
import { AuditAction } from '@hr-system/types'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type { CreateEmployeeInput, UpdateEmployeeInput, BankInfoInput, ListEmployeesQuery } from './employees.schemas'

function scope(req: Request): string | undefined {
  return (req as OfficeScopedRequest).officeScope
}

function handle(res: Response, err: unknown) {
  if (err instanceof EmployeeError) {
    sendError(res, err.message, err.status)
    return
  }
  throw err
}

export async function list(req: Request, res: Response) {
  try {
    const { items, meta } = await service.listEmployees(scope(req), req.query as ListEmployeesQuery)
    sendSuccess(res, items, meta)
  } catch (err) {
    handle(res, err)
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const employee = await service.getEmployee(req.params.id, scope(req))
    sendSuccess(res, employee)
  } catch (err) {
    handle(res, err)
  }
}

export async function create(req: Request, res: Response) {
  try {
    const result = await service.createEmployee(req.body as CreateEmployeeInput, (req as AuthRequest).user.sub)
    await auditFromRequest(req as AuthRequest, AuditAction.CREATE, 'Employee', result.employee.id, undefined, {
      employeeId: result.employee.employeeId,
    })
    sendCreated(res, result)
  } catch (err) {
    handle(res, err)
  }
}

export async function update(req: Request, res: Response) {
  try {
    const employee = await service.updateEmployee(req.params.id, scope(req), req.body as UpdateEmployeeInput)
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'Employee', employee.id, undefined, req.body)
    sendSuccess(res, employee)
  } catch (err) {
    handle(res, err)
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await service.deactivateEmployee(req.params.id, scope(req))
    await auditFromRequest(req as AuthRequest, AuditAction.DELETE, 'Employee', req.params.id)
    sendSuccess(res, { message: 'Employee deactivated' })
  } catch (err) {
    handle(res, err)
  }
}

export async function getBankInfo(req: Request, res: Response) {
  try {
    const info = await service.getBankInfo(req.params.id, scope(req))
    sendSuccess(res, info)
  } catch (err) {
    handle(res, err)
  }
}

export async function putBankInfo(req: Request, res: Response) {
  try {
    const info = await service.upsertBankInfo(req.params.id, scope(req), req.body as BankInfoInput)
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'BankInfo', req.params.id)
    sendSuccess(res, info)
  } catch (err) {
    handle(res, err)
  }
}

export async function directory(req: Request, res: Response) {
  try {
    const list = await service.getDirectory(scope(req), req.query.search as string | undefined)
    sendSuccess(res, list)
  } catch (err) {
    handle(res, err)
  }
}

export async function orgChart(req: Request, res: Response) {
  try {
    const chart = await service.getOrgChart(req.params.id, scope(req))
    sendSuccess(res, chart)
  } catch (err) {
    handle(res, err)
  }
}
