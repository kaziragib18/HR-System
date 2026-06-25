import type { Response } from 'express'
import type { ApiResponse, PaginationMeta } from '@hr-system/types'

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
