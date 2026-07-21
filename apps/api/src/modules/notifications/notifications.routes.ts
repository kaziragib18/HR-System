import { Router, type Router as RouterType } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { prisma } from '../../config/prisma'
import { sendSuccess, sendError, sendUnexpectedError } from '../../utils/response'
import type { AuthRequest } from '../../middleware/auth.middleware'
import type { Request, Response } from 'express'

export const notificationsRouter: RouterType = Router()

notificationsRouter.use(authenticate)

function user(req: Request) { return (req as AuthRequest).user }

notificationsRouter.get('/', async (req, res) => {
  try {
    const employeeId = user(req).employeeId
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where: { employeeId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where: { employeeId } }),
    ])

    sendSuccess(res, items, { total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (err) { sendUnexpectedError(res, err) }
})

notificationsRouter.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { employeeId: user(req).employeeId, isRead: false },
    })
    sendSuccess(res, { count })
  } catch (err) { sendUnexpectedError(res, err) }
})

notificationsRouter.patch('/read-all', async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { employeeId: user(req).employeeId, isRead: false },
      data: { isRead: true },
    })
    sendSuccess(res, { message: 'All notifications marked as read' })
  } catch (err) { sendUnexpectedError(res, err) }
})

notificationsRouter.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const employeeId = user(req).employeeId
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!notification || notification.employeeId !== employeeId) {
      sendError(res, 'Notification not found', 404)
      return
    }
    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    })
    sendSuccess(res, updated)
  } catch (err) { sendUnexpectedError(res, err) }
})
