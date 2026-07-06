import type { Request, Response } from 'express'
import { prisma } from '../../config/prisma'
import * as service from './departments.service'
import { DepartmentError } from './departments.service'
import { sendSuccess, sendCreated, sendError } from '../../utils/response'
import { auditFromRequest } from '../../utils/audit'
import { AuditAction } from '@hr-system/types'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { OfficeScopedRequest } from '../../middleware/office.middleware'
import type { CreateDepartmentInput, UpdateDepartmentInput, AssignManagerInput } from './departments.schemas'

function scope(req: Request): string | undefined {
  return (req as OfficeScopedRequest).officeScope
}

function handle(res: Response, err: unknown) {
  if (err instanceof DepartmentError) {
    sendError(res, err.message, err.status)
    return
  }
  throw err
}

export async function list(req: Request, res: Response) {
  try {
    sendSuccess(res, await service.listDepartments(scope(req)))
  } catch (err) {
    handle(res, err)
  }
}

export async function tree(req: Request, res: Response) {
  try {
    sendSuccess(res, await service.getDepartmentTree(scope(req)))
  } catch (err) {
    handle(res, err)
  }
}

export async function getById(req: Request, res: Response) {
  try {
    sendSuccess(res, await service.getDepartment(req.params.id, scope(req)))
  } catch (err) {
    handle(res, err)
  }
}

export async function members(req: Request, res: Response) {
  try {
    sendSuccess(res, await service.listMembers(req.params.id, scope(req)))
  } catch (err) {
    handle(res, err)
  }
}

export async function create(req: Request, res: Response) {
  try {
    const body = { ...(req.body as CreateDepartmentInput), officeId: scope(req) ?? (req.body as CreateDepartmentInput).officeId }
    const dept = await service.createDepartment(body)
    await auditFromRequest(req as AuthRequest, AuditAction.CREATE, 'Department', dept.id, undefined, dept)
    sendCreated(res, dept)
  } catch (err) {
    handle(res, err)
  }
}

export async function update(req: Request, res: Response) {
  try {
    const dept = await service.updateDepartment(req.params.id, scope(req), req.body as UpdateDepartmentInput)
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'Department', dept.id, undefined, req.body)
    sendSuccess(res, dept)
  } catch (err) {
    handle(res, err)
  }
}

export async function remove(req: Request, res: Response) {
  try {
    await service.deactivateDepartment(req.params.id, scope(req))
    await auditFromRequest(req as AuthRequest, AuditAction.DELETE, 'Department', req.params.id)
    sendSuccess(res, { message: 'Department deactivated' })
  } catch (err) {
    handle(res, err)
  }
}

export async function assignManager(req: Request, res: Response) {
  try {
    const { managerId } = req.body as AssignManagerInput
    const dept = await service.assignManager(req.params.id, scope(req), managerId)
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'Department', dept.id, undefined, { managerId })
    sendSuccess(res, dept)
  } catch (err) {
    handle(res, err)
  }
}

export async function removeManager(req: Request, res: Response) {
  try {
    const dept = await service.getDepartment(req.params.id, scope(req))
    const updated = await prisma.department.update({
      where: { id: dept.id },
      data: { managerId: null },
    })
    await auditFromRequest(req as AuthRequest, AuditAction.UPDATE, 'Department', dept.id, undefined, { managerId: null })
    sendSuccess(res, updated)
  } catch (err) {
    handle(res, err)
  }
}
