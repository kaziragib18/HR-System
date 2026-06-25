import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../utils/jwt'
import { sendUnauthorized } from '../utils/response'
import type { AccessTokenPayload } from '../utils/jwt'

export interface AuthRequest extends Request {
  user: AccessTokenPayload
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    sendUnauthorized(res)
    return
  }

  const token = authHeader.slice(7)
  try {
    const payload = verifyAccessToken(token)
    ;(req as AuthRequest).user = payload
    next()
  } catch {
    sendUnauthorized(res)
  }
}
