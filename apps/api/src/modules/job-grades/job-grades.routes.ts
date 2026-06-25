import { Router, type Router as RouterType, type Request, type Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma'
import { authenticate } from '../../middleware/auth.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { officeScope, type OfficeScopedRequest } from '../../middleware/office.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess, sendCreated } from '../../utils/response'
import { UserRole } from '@hr-system/types'

const router: RouterType = Router()
router.use(authenticate, officeScope)

const gradeSchema = z.object({
  name: z.string().min(1),
  band: z.string().min(1),
  level: z.coerce.number().int().min(1).max(10),
  officeId: z.string().min(1),
})

const titleSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().optional(),
})

// ─── Job Grades ───────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const scope = (req as OfficeScopedRequest).officeScope
  const grades = await prisma.jobGrade.findMany({
    where: { isActive: true, ...(scope ? { officeId: scope } : {}) },
    orderBy: { level: 'asc' },
  })
  sendSuccess(res, grades)
})

router.post('/', requireRole(UserRole.HR_MANAGER), validate(gradeSchema), async (req: Request, res: Response) => {
  const grade = await prisma.jobGrade.create({ data: req.body })
  sendCreated(res, grade)
})

// ─── Job Titles (mounted under same router for convenience) ─────────────────────
router.get('/titles', async (req: Request, res: Response) => {
  const titles = await prisma.jobTitle.findMany({
    where: { isActive: true },
    include: { department: { select: { name: true } } },
    orderBy: { name: 'asc' },
  })
  sendSuccess(res, titles)
})

router.post('/titles', requireRole(UserRole.HR_MANAGER), validate(titleSchema), async (req: Request, res: Response) => {
  const title = await prisma.jobTitle.create({ data: req.body })
  sendCreated(res, title)
})

export { router as jobGradesRouter }
