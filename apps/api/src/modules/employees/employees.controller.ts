import type { Request, Response } from 'express'
import * as service from './employees.service'
import { EmployeeError } from './employees.service'
import * as authService from '../auth/auth.service'
import { prisma } from '../../config/prisma'
import { env } from '../../config/env'
import { sendSuccess, sendCreated, sendError } from '../../utils/response'
import { auditFromRequest } from '../../utils/audit'
import { AuditAction, UserRole } from '@hr-system/types'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type { CreateEmployeeInput, UpdateEmployeeInput, BankInfoInput, ListEmployeesQuery, DirectoryQuery } from './employees.schemas'

function scope(req: Request): string | undefined {
  return (req as OfficeScopedRequest).officeScope
}

// Fields a non-HR self-edit may touch — org/employment fields (department, job
// title, status, reporting line, dates, etc.) stay HR-only even when editing
// your own record, since PATCH /:id is reachable by self via SELF_OR_HR.
// Identity fields (name, email) are also excluded — only HR_MANAGER/SUPER_ADMIN
// may change what an employee is called or their login email, even for self.
const SELF_EDITABLE_FIELDS = [
  'phone', 'dateOfBirth', 'gender',
  'nationality', 'nationalId', 'passportNumber',
  'presentAddress', 'permanentAddress', 'emergencyContact', 'bio',
  'bloodGroup', 'isBloodDonor', 'lastDonationDate', 'nomineeInfo',
] as const

function restrictToPersonalFields(body: UpdateEmployeeInput): UpdateEmployeeInput {
  const allowed = new Set<string>(SELF_EDITABLE_FIELDS)
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => allowed.has(key))
  ) as UpdateEmployeeInput
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
    const body = { ...(req.body as CreateEmployeeInput), officeId: scope(req) ?? (req.body as CreateEmployeeInput).officeId }
    const result = await service.createEmployee(body, (req as AuthRequest).user.sub)
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
    const authReq = req as AuthRequest
    const isHR = [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER].includes(authReq.user.role as UserRole)
    // Reachable here either as HR+ (any field) or as self via SELF_OR_HR (personal fields only).
    const body = isHR ? (req.body as UpdateEmployeeInput) : restrictToPersonalFields(req.body as UpdateEmployeeInput)
    const employee = await service.updateEmployee(req.params.id, scope(req), body)
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'Employee', employee.id, undefined, body)
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

// No email channel exists in this codebase — HR generates a reset link/token
// here and relays it to the employee manually, the same trust model as the
// temp password shown once at creation time.
export async function generatePasswordReset(req: Request, res: Response) {
  try {
    const employee = await service.getEmployee(req.params.id, scope(req))
    const user = await prisma.user.findUnique({ where: { employeeId: employee.id } })
    if (!user) {
      sendError(res, 'This employee has no login account', 404)
      return
    }
    const { token, expiresAt } = await authService.requestPasswordReset(user.id)
    const resetLink = `${env.WEB_APP_URL}/reset-password?token=${token}`
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'User', user.id, undefined, {
      action: 'password_reset_generated',
    })
    sendSuccess(res, { token, resetLink, expiresAt })
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
    const { items, meta } = await service.getDirectory(scope(req), req.query as DirectoryQuery)
    sendSuccess(res, items, meta)
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
