import type { Request, Response, NextFunction } from 'express'
import { UserRole } from '@hr-system/types'
import { sendForbidden } from '../utils/response'
import type { AuthRequest } from './auth.middleware'
import type { AccessTokenPayload } from '../utils/jwt'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 5,
  [UserRole.HR_MANAGER]: 4,
  [UserRole.DEPT_HEAD]: 3,
  [UserRole.DEPT_MANAGER]: 2,
  [UserRole.EMPLOYEE]: 1,
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).user
    if (!user) {
      sendForbidden(res)
      return
    }

    const userLevel = ROLE_HIERARCHY[user.role as UserRole] ?? 0
    const hasAccess = allowedRoles.some((role) => userLevel >= ROLE_HIERARCHY[role])

    if (!hasAccess) {
      sendForbidden(res)
      return
    }

    next()
  }
}

export function requireExactRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).user
    if (!user || !roles.includes(user.role as UserRole)) {
      sendForbidden(res)
      return
    }
    next()
  }
}

/**
 * Allows the request through if the authenticated user IS the target employee
 * (req.params[paramName]), OR holds one of allowedRoles or higher.
 * Use for "self can edit their own X; HR_MANAGER+ can edit anyone's" routes.
 */
export function selfOrRole(paramName: string, ...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthRequest).user
    if (!user) {
      sendForbidden(res)
      return
    }
    if (isSelfOrRole(user, req.params[paramName], ...allowedRoles)) {
      next()
      return
    }
    sendForbidden(res)
  }
}

/**
 * Plain predicate version of selfOrRole, for use inside controllers/services when
 * the target employeeId isn't available as a route param (e.g. resolved from a
 * DB row, or found in the request body of a multipart upload).
 */
export function isSelfOrRole(
  user: AccessTokenPayload,
  targetEmployeeId: string,
  ...allowedRoles: UserRole[]
): boolean {
  if (user.employeeId === targetEmployeeId) return true
  const userLevel = ROLE_HIERARCHY[user.role as UserRole] ?? 0
  return allowedRoles.some((role) => userLevel >= ROLE_HIERARCHY[role])
}
