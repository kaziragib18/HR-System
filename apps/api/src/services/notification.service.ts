import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { logger } from '../config/logger'
import { NotificationType, UserRole } from '@hr-system/types'

export async function createNotification(
  employeeId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { employeeId, type, title, body, data: (data ?? {}) as Prisma.InputJsonValue },
    })
  } catch (err) {
    logger.error({ err }, 'Failed to create notification')
  }
}

/**
 * Notifies every SUPER_ADMIN and HR_MANAGER in an office that a new team
 * request (leave, late excuse, attendance adjustment) has come in — additive
 * to the single resolved reporting-chain approver's own notification
 * (createNotification'd separately by the caller), not a replacement for it.
 * `excludeEmployeeId` avoids double-notifying an admin who also happens to be
 * the resolved approver (e.g. a HR department's own DEPT_HEAD).
 */
export async function notifyOfficeAdmins(
  officeId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  excludeEmployeeId?: string
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: {
      employee: { officeId },
      role: { in: [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER] },
      ...(excludeEmployeeId ? { employeeId: { not: excludeEmployeeId } } : {}),
    },
    select: { employeeId: true },
  })
  for (const admin of admins) {
    await createNotification(admin.employeeId, type, title, body, data)
  }
}
