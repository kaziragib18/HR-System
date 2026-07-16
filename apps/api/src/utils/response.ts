import type { Response } from 'express'
import type { ApiResponse, PaginationMeta } from '@hr-system/types'
import { logger } from '../config/logger'

export function sendSuccess<T>(
  res: Response,
  data: T,
  meta?: PaginationMeta,
  status = 200
): void {
  const payload: ApiResponse<T> = { success: true, data }
  if (meta) payload.meta = meta
  res.status(status).json(payload)
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, undefined, 201)
}

export function sendError(res: Response, message: string, status = 400): void {
  const payload: ApiResponse = { success: false, error: message }
  res.status(status).json(payload)
}

export function sendNotFound(res: Response, resource = 'Resource'): void {
  sendError(res, `${resource} not found`, 404)
}

export function sendForbidden(res: Response): void {
  sendError(res, 'Insufficient permissions', 403)
}

export function sendUnauthorized(res: Response): void {
  sendError(res, 'Unauthorized', 401)
}

/**
 * Every module's controller `handle(res, err)` helper checks its own typed
 * error class (AuthError, LeaveError, AttendanceError, ...) and otherwise
 * used to `throw err` — but these controllers are async Express 4 route
 * handlers with no `next(err)` wiring, so a re-thrown error became an
 * unhandled promise rejection at the process level instead of an HTTP
 * response. On Node 15+, an unhandled rejection crashes the whole process
 * by default — so any single unexpected error (e.g. a transient DB hiccup)
 * took down the API for every user, not just the one request that hit it.
 * Call this instead of re-throwing: it always sends a real response (never
 * leaves the request hanging) and never lets the error escape the request.
 */
export function sendUnexpectedError(res: Response, err: unknown): void {
  logger.error({ err }, 'Unhandled controller error')
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err instanceof Error ? err.message : 'Unknown error'
  sendError(res, message, 500)
}
