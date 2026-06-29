import { Router, type Router as RouterType, type Request, type Response } from 'express'
import { prisma } from '../../config/prisma'
import { authenticate, type AuthRequest } from '../../middleware/auth.middleware'
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

function monthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

// ─── Employee self-service dashboard ──────────────────────────────────────────
router.get('/me', async (req: Request, res: Response) => {
  const employeeId = (req as AuthRequest).user.employeeId
  const { start: todayStart, end: todayEnd } = todayRange()
  const { start: monthStart, end: monthEnd } = monthRange()
  const year = new Date().getFullYear()

  const me = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      departmentId: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      department: { select: { name: true } },
      reportingTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          jobTitle: { select: { name: true } },
          reportingTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              jobTitle: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  const [today, leaveBalances, myApplications, attendanceMonth, teamRaw] = await Promise.all([
    prisma.attendance.findFirst({
      where: { employeeId, date: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveType: { select: { name: true, code: true } } },
    }),
    prisma.leaveApplication.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { leaveType: { select: { name: true, code: true } } },
    }),
    prisma.attendance.findMany({
      where: { employeeId, date: { gte: monthStart, lte: monthEnd } },
      select: { date: true, status: true, checkIn: true, checkOut: true },
      orderBy: { date: 'asc' },
    }),
    me?.departmentId
      ? prisma.employee.findMany({
          where: {
            departmentId: me.departmentId,
            employmentStatus: { not: 'TERMINATED' },
          },
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          take: 8,
        })
      : Promise.resolve([]),
  ])

  // Resolve today's status for each teammate
  const teamIds = teamRaw.map((t) => t.id)
  const teamAttendance = await prisma.attendance.findMany({
    where: { employeeId: { in: teamIds }, date: { gte: todayStart, lte: todayEnd } },
    select: { employeeId: true, status: true },
  })
  const statusByEmp = Object.fromEntries(teamAttendance.map((a) => [a.employeeId, a.status]))
  const team = teamRaw.map((t) => ({
    id: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    avatarUrl: t.avatarUrl,
    todayStatus: statusByEmp[t.id] ?? 'ABSENT',
    isSelf: t.id === employeeId,
  }))

  const managerChain = me?.reportingTo ? [
    {
      id: me.reportingTo.id,
      firstName: me.reportingTo.firstName,
      lastName: me.reportingTo.lastName,
      avatarUrl: me.reportingTo.avatarUrl,
      jobTitle: me.reportingTo.jobTitle?.name ?? null,
      relation: 'Direct Supervisor',
    },
    ...(me.reportingTo.reportingTo ? [{
      id: me.reportingTo.reportingTo.id,
      firstName: me.reportingTo.reportingTo.firstName,
      lastName: me.reportingTo.reportingTo.lastName,
      avatarUrl: me.reportingTo.reportingTo.avatarUrl,
      jobTitle: me.reportingTo.reportingTo.jobTitle?.name ?? null,
      relation: 'Dotted Supervisor',
    }] : []),
  ] : []

  sendSuccess(res, {
    me: me ? {
      id: me.id,
      firstName: me.firstName,
      lastName: me.lastName,
      avatarUrl: me.avatarUrl,
      department: me.department?.name ?? null,
      managerName: me.reportingTo ? `${me.reportingTo.firstName} ${me.reportingTo.lastName}` : null,
    } : null,
    managers: managerChain,
    today,
    leaveBalances: leaveBalances.map((b) => ({
      code: b.leaveType.code,
      name: b.leaveType.name,
      entitled: Number(b.entitled),
      taken: Number(b.taken),
      pending: Number(b.pending),
      remaining: Number(b.entitled) + Number(b.carriedForward) - Number(b.taken),
    })),
    myApplications: myApplications.map((a) => ({
      id: a.id,
      type: a.leaveType.name,
      code: a.leaveType.code,
      startDate: a.startDate,
      endDate: a.endDate,
      totalDays: Number(a.totalDays),
      status: a.status,
      createdAt: a.createdAt,
    })),
    attendanceMonth,
    team,
  })
})

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
      id: true,
      name: true,
      code: true,
      office: { select: { code: true } },
      manager: { select: { firstName: true, lastName: true, jobTitle: { select: { name: true } } } },
      _count: { select: { employees: { where: { employmentStatus: { not: 'TERMINATED' } } } } },
    },
    orderBy: [{ office: { code: 'asc' } }, { name: 'asc' }],
  })
  sendSuccess(res, departments.map((d) => ({
    id: d.id,
    department: d.name,
    code: d.code,
    officeCode: d.office.code,
    count: d._count.employees,
    manager: d.manager ? `${d.manager.firstName} ${d.manager.lastName}` : null,
    managerTitle: d.manager?.jobTitle?.name ?? null,
  })))
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
