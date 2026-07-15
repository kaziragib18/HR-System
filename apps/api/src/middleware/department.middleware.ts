import type { Request, Response, NextFunction } from 'express'
import { UserRole } from '@hr-system/types'
import { prisma } from '../config/prisma'
import type { AuthRequest } from './auth.middleware'

/**
 * Resolves a department-level scope for the current request — one level
 * narrower than officeScope.
 *
 * - DEPT_HEAD/DEPT_MANAGER are locked to their own department regardless of
 *   query params (mirrors officeScope's role-based locking).
 * - Everyone else (SUPER_ADMIN, HR_MANAGER) is left unrestricted here —
 *   office-level scoping already applies separately via officeScope.
 *
 * Read `req.departmentScope` in services: `undefined` means "no department
 * restriction beyond office scope."
 */
export interface DepartmentScopedRequest extends AuthRequest {
  departmentScope?: string
}

export async function departmentScope(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const r = req as DepartmentScopedRequest
  if (r.user.role === UserRole.DEPT_HEAD || r.user.role === UserRole.DEPT_MANAGER) {
    const employee = await prisma.employee.findUnique({
      where: { id: r.user.employeeId },
      select: { departmentId: true },
    })
    r.departmentScope = employee?.departmentId
  }
  next()
}
