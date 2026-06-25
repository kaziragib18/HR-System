import { prisma } from '../config/prisma'
import { logger } from '../config/logger'
import type { AuthRequest } from '../middleware/auth.middleware'
import type { AuditAction } from '@hr-system/types'

interface AuditParams {
  userId: string
  action: AuditAction | string
  resource: string
  resourceId?: string
  oldValue?: unknown
  newValue?: unknown
  ipAddress?: string
  userAgent?: string
}

/**
 * Writes an immutable audit-log entry. Fire-and-forget: failures are logged
 * but never block the request.
 */
export async function writeAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        oldValue: params.oldValue as object | undefined,
        newValue: params.newValue as object | undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  } catch (err) {
    logger.error({ err }, 'Failed to write audit log')
  }
}

/** Convenience overload that pulls actor + request metadata from the request. */
export function auditFromRequest(
  req: AuthRequest,
  action: AuditAction | string,
  resource: string,
  resourceId?: string,
  oldValue?: unknown,
  newValue?: unknown
): Promise<void> {
  return writeAudit({
    userId: req.user.sub,
    action,
    resource,
    resourceId,
    oldValue,
    newValue,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']?.slice(0, 255),
  })
}
