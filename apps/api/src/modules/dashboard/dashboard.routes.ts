import { Router, type Router as RouterType, type Request, type Response } from 'express'
import { prisma } from '../../config/prisma'
import { authenticate } from '../../middleware/auth.middleware'
import { requireRole } from '../../middleware/rbac.middleware'
import { officeScope, type OfficeScopedRequest } from '../../middleware/office.middleware'
import { sendSuccess } from '../../utils/response'
import { UserRole } from '@hr-system/types'

const router: RouterType = Router()
router.use(authenticate, officeScope)

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

router.get('/stats', requireRole(UserRole.TEAM_LEAD), async (req: Request, res: Response) => {
  const scope = (req as OfficeScopedRequest).officeScope
  const officeFilter = scope ? { officeId: scope } : {}
  const { start, end } = todayRange()

  const [headcount, onProbation, onLeaveToday, lateToday, pendingLeaves, openTimesheets] =
    await Promise.all([
      prisma.employee.count({ where: { ...officeFilter, employmentStatus: { not: 'TERMINATED' } } }),
      prisma.employee.count({ where: { ...officeFilter, employmentStatus: 'PROBATION' } }),
      prisma.leaveApplication.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: end },
          endDate: { gte: start },
          ...(scope ? { employee: { officeId: scope } } : {}),
        },
      }),
      prisma.attendance.count({
        where: {
          status: 'LATE',
          date: { gte: start, lte: end },
          ...(scope ? { employee: { officeId: scope } } : {}),
        },
      }),
      prisma.leaveApplication.count({
        where: { status: 'PENDING', ...(scope ? { employee: { officeId: scope } } : {}) },
      }),
      prisma.timesheet.count({
        where: { status: 'SUBMITTED', ...(scope ? { employee: { officeId: scope } } : {}) },
      }),
    ])

  sendSuccess(res, {
    headcount,
    onProbation,
    onLeaveToday,
    lateToday,
    pendingLeaves,
    openTimesheets,
  })
})

router.get('/headcount-by-department', requireRole(UserRole.TEAM_LEAD), async (req: Request, res: Response) => {
  const scope = (req as OfficeScopedRequest).officeScope
  const departments = await prisma.department.findMany({
    where: { isActive: true, ...(scope ? { officeId: scope } : {}) },
    select: {
      name: true,
      _count: { select: { employees: { where: { employmentStatus: { not: 'TERMINATED' } } } } },
    },
  })
  sendSuccess(
    res,
    departments.map((d) => ({ department: d.name, count: d._count.employees }))
  )
})

router.get('/on-leave-today', requireRole(UserRole.TEAM_LEAD), async (req: Request, res: Response) => {
  const scope = (req as OfficeScopedRequest).officeScope
  const { start, end } = todayRange()
  const leaves = await prisma.leaveApplication.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: end },
      endDate: { gte: start },
      ...(scope ? { employee: { officeId: scope } } : {}),
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      employee: { select: { firstName: true, lastName: true, avatarUrl: true } },
      leaveType: { select: { name: true } },
    },
  })
  sendSuccess(res, leaves)
})

export { router as dashboardRouter }
