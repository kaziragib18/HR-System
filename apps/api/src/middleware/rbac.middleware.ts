import type { Response, NextFunction } from 'express'
import { UserRole } from '@hr-system/types'
import { sendForbidden } from '../utils/response'
import type { AuthRequest } from './auth.middleware'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 5,
  [UserRole.HR_MANAGER]: 4,
  [UserRole.DEPT_HEAD]: 3,
  [UserRole.TEAM_LEAD]: 2,
  [UserRole.EMPLOYEE]: 1,
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendForbidden(res)
      return
    }

    const userLevel = ROLE_HIERARCHY[req.user.role as UserRole] ?? 0
    const hasAccess = allowedRoles.some(
      (role) => userLevel >= ROLE_HIERARCHY[role]
    )

    if (!hasAccess) {
      sendForbidden(res)
      return
    }

    next()
  }
}

export function requireExactRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role as UserRole)) {
      sendForbidden(res)
      return
    }
    next()
  }
}
