import { Router, type Router as RouterType } from 'express'
import { z } from 'zod'
import { prisma } from '../../config/prisma'
import { authenticate, type AuthRequest } from '../../middleware/auth.middleware'
import { officeScope, type OfficeScopedRequest } from '../../middleware/office.middleware'
import { validate } from '../../middleware/validate.middleware'
import { sendSuccess } from '../../utils/response'
import { UserRole } from '@hr-system/types'

const router: RouterType = Router()
router.use(authenticate, officeScope)

const historyQuery = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year:  z.coerce.number().int().min(2020).max(2100),
})

router.get('/history', validate(historyQuery, 'query'), async (req, res, next) => {
  try {
    const r = req as OfficeScopedRequest
    const { month, year } = r.query as unknown as z.infer<typeof historyQuery>
    const role = r.user!.role as UserRole
    const myEmployeeId = r.user!.employeeId
    const scope = r.officeScope

    const isAdmin = role === UserRole.SUPER_ADMIN || role === UserRole.HR_MANAGER

    const start = new Date(Date.UTC(year, month - 1, 1))
    const end   = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

    // ── 1. Leave approval history ──────────────────────────────────────────────
    const leaveHistory = await prisma.leaveApprovalHistory.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(isAdmin
          ? scope ? { application: { employee: { officeId: scope } } } : {}
          : { approverId: myEmployeeId }),
      },
      include: {
        application: {
          include: {
            employee: {
              select: {
                id: true, firstName: true, lastName: true, employeeId: true,
                department: { select: { id: true, name: true } },
              },
            },
            leaveType: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // ── 2. Late excuse history ─────────────────────────────────────────────────
    const excuseHistory = await prisma.attendance.findMany({
      where: {
        excuseReviewedAt: { gte: start, lte: end },
        excuseStatus: { in: ['APPROVED', 'REJECTED'] },
        excuseReviewedBy: { not: null },
        ...(isAdmin
          ? scope ? { employee: { officeId: scope } } : {}
          : { excuseReviewedBy: myEmployeeId }),
      },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeId: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    })

    // ── 3. Attendance adjustment-request history ───────────────────────────────
    const adjustmentHistory = await prisma.attendance.findMany({
      where: {
        adjustmentReviewedAt: { gte: start, lte: end },
        adjustmentStatus: { in: ['APPROVED', 'REJECTED'] },
        adjustmentReviewedBy: { not: null },
        ...(isAdmin
          ? scope ? { employee: { officeId: scope } } : {}
          : { adjustmentReviewedBy: myEmployeeId }),
      },
      include: {
        employee: {
          select: {
            id: true, firstName: true, lastName: true, employeeId: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    })

    // ── Resolve approver names ─────────────────────────────────────────────────
    const actorIds: string[] = [...new Set([
      ...leaveHistory.map(h => h.approverId),
      ...excuseHistory.map(a => a.excuseReviewedBy).filter(Boolean) as string[],
      ...adjustmentHistory.map(a => a.adjustmentReviewedBy).filter(Boolean) as string[],
    ])]

    const actors = actorIds.length
      ? await prisma.employee.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true, jobTitle: { select: { name: true } } },
        })
      : []
    const actorMap = Object.fromEntries(actors.map(e => [e.id, e]))

    // ── Build unified timeline ─────────────────────────────────────────────────
    const items = [
      ...leaveHistory.map(h => ({
        id: h.id,
        type: 'LEAVE' as const,
        action: h.action,
        actionAt: h.createdAt.toISOString(),
        level: h.level,
        comment: h.comment ?? null,
        approverId: h.approverId,
        approver: actorMap[h.approverId] ?? null,
        employee: h.application.employee,
        leaveType: h.application.leaveType,
        startDate: h.application.startDate.toISOString(),
        endDate: h.application.endDate.toISOString(),
        totalDays: h.application.totalDays,
      })),
      ...excuseHistory.map(a => ({
        id: `ex-${a.id}`,
        type: 'EXCUSE' as const,
        action: a.excuseStatus as 'APPROVED' | 'REJECTED',
        actionAt: a.excuseReviewedAt!.toISOString(),
        level: null,
        comment: null,
        approverId: a.excuseReviewedBy!,
        approver: actorMap[a.excuseReviewedBy!] ?? null,
        employee: a.employee,
        date: a.date.toISOString(),
        lateMinutes: a.lateMinutes,
        lateExcuse: a.lateExcuse ?? null,
      })),
      ...adjustmentHistory.map(a => ({
        id: `adj-${a.id}`,
        type: 'ADJUSTMENT' as const,
        action: a.adjustmentStatus as 'APPROVED' | 'REJECTED',
        actionAt: a.adjustmentReviewedAt!.toISOString(),
        level: null,
        comment: a.adjustmentReason ?? null,
        approverId: a.adjustmentReviewedBy!,
        approver: actorMap[a.adjustmentReviewedBy!] ?? null,
        employee: a.employee,
        date: a.date.toISOString(),
        requestedCheckIn: a.requestedCheckIn?.toISOString() ?? null,
        requestedCheckOut: a.requestedCheckOut?.toISOString() ?? null,
      })),
    ].sort((a, b) => new Date(b.actionAt).getTime() - new Date(a.actionAt).getTime())

    return sendSuccess(res, items)
  } catch (err) {
    next(err)
  }
})

export const approvalsRouter = router
