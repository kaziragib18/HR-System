import { Router, type Router as RouterType, type Request, type Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma'
import { authenticate } from '../../middleware/auth.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { officeScope, type OfficeScopedRequest } from '../../middleware/office.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess, sendCreated, sendError } from '../../utils/response'
import { UserRole } from '@hr-system/types'

const router: RouterType = Router()
router.use(authenticate, officeScope)

const createSchema = z.object({
  officeId: z.string().min(1),
  name: z.string().min(1),
  date: z.string().datetime(),
  isRecurring: z.boolean().optional(),
})

const listQuerySchema = z.object({
  year: z.coerce.number().optional(),
  officeId: z.string().optional(),
  officeCode: z.string().optional(),
})

router.get('/', validate(listQuerySchema, 'query'), async (req: Request, res: Response) => {
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear()
  const officeCode = req.query.officeCode as string | undefined

  // Holidays are public info — no office scope filter on listing.
  // Optionally filter by officeCode (e.g. "BD" or "UK").
  const holidays = await prisma.publicHoliday.findMany({
    where: {
      year,
      ...(officeCode ? { office: { code: officeCode } } : {}),
    },
    include: { office: { select: { code: true, name: true } } },
    orderBy: { date: 'asc' },
  })
  sendSuccess(res, holidays)
})

router.post('/', requireRole(UserRole.HR_MANAGER), validate(createSchema), async (req: Request, res: Response) => {
  const { name, date, isRecurring } = req.body
  const officeId = (req as OfficeScopedRequest).officeScope ?? req.body.officeId
  const d = new Date(date)
  try {
    const holiday = await prisma.publicHoliday.create({
      data: { officeId, name, date: d, year: d.getFullYear(), isRecurring: isRecurring ?? false },
    })
    sendCreated(res, holiday)
  } catch {
    sendError(res, 'A holiday already exists on that date for this office', 409)
  }
})

router.delete('/:id', requireRole(UserRole.HR_MANAGER), async (req: Request, res: Response) => {
  await prisma.publicHoliday.delete({ where: { id: req.params.id } })
  sendSuccess(res, { message: 'Holiday removed' })
})

export { router as holidaysRouter }
