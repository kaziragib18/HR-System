import type { Request, Response, NextFunction } from 'express'
import { UserRole } from '@hr-system/types'
import type { AuthRequest } from './auth.middleware'

/**
 * Resolves the office scope for the current request.
 *
 * - SUPER_ADMIN may pass `?officeId=` to act on any office; if omitted, the
 *   filter is left undefined (sees all offices).
 * - Everyone else is locked to their own office regardless of query params.
 *
 * Read `req.officeScope` in services: `undefined` means "all offices".
 */
export interface OfficeScopedRequest extends AuthRequest {
  officeScope?: string
}

export function officeScope(req: Request, _res: Response, next: NextFunction): void {
  const r = req as OfficeScopedRequest
  if (r.user.role === UserRole.SUPER_ADMIN) {
    const requested = (req.query.officeId as string) || undefined
    r.officeScope = requested
  } else {
    r.officeScope = r.user.officeId
  }
  next()
}
