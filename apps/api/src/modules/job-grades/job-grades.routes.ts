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
  const { departmentId } = req.query as { departmentId?: string }
  const titles = await prisma.jobTitle.findMany({
    where: { isActive: true, ...(departmentId ? { departmentId } : {}) },
    include: { department: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })
  sendSuccess(res, titles)
})

router.post('/titles', requireRole(UserRole.HR_MANAGER), validate(titleSchema), async (req: Request, res: Response) => {
  const { name, departmentId } = req.body as { name: string; departmentId?: string }
  const duplicate = await prisma.jobTitle.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, departmentId: departmentId ?? null, isActive: true },
  })
  if (duplicate) {
    sendError(res, `A designation named "${name}" already exists in this department`, 409)
    return
  }
  const title = await prisma.jobTitle.create({ data: req.body })
  sendCreated(res, title)
})

router.patch('/titles/:id', requireRole(UserRole.HR_MANAGER), validate(titleSchema.partial()), async (req: Request, res: Response) => {
  const { name, departmentId } = req.body as { name?: string; departmentId?: string }
  if (name) {
    const existing = await prisma.jobTitle.findUnique({ where: { id: req.params.id } })
    const duplicate = await prisma.jobTitle.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        departmentId: departmentId ?? existing?.departmentId ?? null,
        isActive: true,
        id: { not: req.params.id },
      },
    })
    if (duplicate) {
      sendError(res, `A designation named "${name}" already exists in this department`, 409)
      return
    }
  }
  const title = await prisma.jobTitle.update({ where: { id: req.params.id }, data: req.body })
  sendSuccess(res, title)
})

router.delete('/titles/:id', requireRole(UserRole.HR_MANAGER), async (req: Request, res: Response) => {
  await prisma.jobTitle.update({ where: { id: req.params.id }, data: { isActive: false } })
  sendSuccess(res, null)
})

export { router as jobGradesRouter }
