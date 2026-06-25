import { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { logger } from '../config/logger'
import { NotificationType } from '@hr-system/types'

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
