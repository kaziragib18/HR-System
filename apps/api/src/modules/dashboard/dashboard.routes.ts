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

const TEAM_ROLE_RANK: Record<string, number> = { DEPT_HEAD: 0, DEPT_MANAGER: 1, HR_MANAGER: 1, EMPLOYEE: 2 }

// ─── Employee self-service dashboard ──────────────────────────────────────────
router.get('/me', async (req: Request, res: Response) => {
  const { employeeId, role } = (req as AuthRequest).user
  const { start: todayStart, end: todayEnd } = todayRange()
  const { start: monthStart, end: monthEnd } = monthRange()
  const year = new Date().getFullYear()

  // All five queries run in one parallel batch (a single DB round-trip). The
  // department roster, headcount, per-teammate today-status, and direct-report
  // count are folded into the `me` query via nested relations rather than fired
  // as follow-up queries — the previous shape did three *sequential* round-trips
  // (me -> Promise.all -> team attendance), which on the remote pooler cost ~4s.
  const [me, today, leaveBalances, myApplications, attendanceMonth] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        departmentId: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        email: true,
        employmentStatus: true,
        joiningDate: true,
        department: {
          select: {
            name: true,
            // The authoritative department head (Department.managerId, enforced
            // one-per-department) — not assumed via a second reportingTo hop,
            // which doesn't always land on the actual head.
            manager: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true, jobTitle: { select: { name: true } } },
            },
            // "My Team" is the caller's whole department for every role — a plain
            // EMPLOYEE sees all their department colleagues, not just the sub-team
            // sharing their manager. (Approval power still stays scoped to a
            // DEPT_MANAGER's own reports; this is a visibility-only card.) Each
            // teammate carries today's attendance status inline so no separate
            // team-attendance query is needed.
            employees: {
              where: { employmentStatus: { not: 'TERMINATED' } },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                reportingToId: true,
                jobTitle: { select: { name: true } },
                user: { select: { role: true } },
                attendance: {
                  where: { date: { gte: todayStart, lte: todayEnd } },
                  select: { status: true },
                  take: 1,
                },
              },
            },
          },
        },
        reportingTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            jobTitle: { select: { name: true } },
            user: { select: { role: true } },
          },
        },
      },
    }),
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
  ])

  // Whole department, sorted DEPT_HEAD -> DEPT_MANAGER -> EMPLOYEE, then name.
  const roster = me?.department?.employees ?? []
  const teamRaw = [...roster].sort((a, b) => {
    const ra = TEAM_ROLE_RANK[a.user?.role ?? ''] ?? 3
    const rb = TEAM_ROLE_RANK[b.user?.role ?? ''] ?? 3
    return ra !== rb ? ra - rb : a.firstName.localeCompare(b.firstName)
  })
  const departmentHeadcount = roster.length
  const directReportsCount = roster.filter((e) => e.reportingToId === employeeId).length
  const team = teamRaw.map((t) => ({
    id: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    avatarUrl: t.avatarUrl,
    todayStatus: t.attendance[0]?.status ?? 'ABSENT',
    isSelf: t.id === employeeId,
    designation: t.jobTitle?.name ?? null,
    role: t.user?.role ?? null,
  }))

  // A DEPT_HEAD is the top of their own department — the reportingTo chain
  // some of them carry (org-chart continuity, e.g. IT-SW/TS/WD heads under
  // IT's head) isn't a functional "my manager" worth a dedicated card; that
  // hierarchy is shown via the team card's role ordering instead.
  //
  // Below DEPT_HEAD, show the employee's real direct manager labelled by
  // their actual role (Department Manager vs. Department Head — someone can
  // report straight to the head with no manager layer in between), plus the
  // department's authoritative head (Department.managerId) if that's a
  // different person — not a second reportingTo hop, which doesn't reliably
  // land on the actual head.
  const managerChain: Array<{
    id: string; firstName: string; lastName: string
    avatarUrl: string | null; jobTitle: string | null; relation: string
  }> = []
  const directManager = me?.reportingTo
  if (directManager && role !== UserRole.DEPT_HEAD) {
    const directManagerRole = directManager.user?.role
    managerChain.push({
      id: directManager.id,
      firstName: directManager.firstName,
      lastName: directManager.lastName,
      avatarUrl: directManager.avatarUrl,
      jobTitle: directManager.jobTitle?.name ?? null,
      relation:
        directManagerRole === UserRole.DEPT_MANAGER ? 'Department Manager' :
        directManagerRole === UserRole.DEPT_HEAD ? 'Department Head' :
        'Manager',
    })
  }
  const deptHead = me?.department?.manager
  if (deptHead && role !== UserRole.DEPT_HEAD && deptHead.id !== directManager?.id) {
    managerChain.push({
      id: deptHead.id,
      firstName: deptHead.firstName,
      lastName: deptHead.lastName,
      avatarUrl: deptHead.avatarUrl,
      jobTitle: deptHead.jobTitle?.name ?? null,
      relation: 'Department Head',
    })
  }

  sendSuccess(res, {
    me: me ? {
      id: me.id,
      firstName: me.firstName,
      lastName: me.lastName,
      avatarUrl: me.avatarUrl,
      email: me.email,
      employmentStatus: me.employmentStatus,
      joiningDate: me.joiningDate,
      department: me.department?.name ?? null,
      managerName: me.reportingTo && role !== UserRole.DEPT_HEAD
        ? `${me.reportingTo.firstName} ${me.reportingTo.lastName}`
        : null,
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
    directReportsCount,
    departmentHeadcount,
  })
})

router.get('/stats', requireRole(UserRole.DEPT_MANAGER), async (req: Request, res: Response) => {
  const scope = (req as OfficeScopedRequest).officeScope
  const officeFilter = scope ? { officeId: scope } : {}
  const { start, end } = todayRange()

  const [headcount, onProbation, onLeaveToday, lateToday, pendingLeaves] =
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
    ])

  sendSuccess(res, {
    headcount,
    onProbation,
    onLeaveToday,
    lateToday,
    pendingLeaves,
  })
})

router.get('/headcount-by-department', requireRole(UserRole.DEPT_MANAGER), async (req: Request, res: Response) => {
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

router.get('/on-leave-today', requireRole(UserRole.DEPT_MANAGER), async (req: Request, res: Response) => {
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
