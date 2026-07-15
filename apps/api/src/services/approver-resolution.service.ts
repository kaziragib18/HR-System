import type { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { UserRole } from '@hr-system/types'

/**
 * Resolves the correct approver for a given chain-level role and employee.
 * DEPT_MANAGER/DEPT_HEAD levels route to the employee's actual manager/department
 * head (via Employee.reportingToId / Department.managerId) rather than an
 * arbitrary user holding that role in the office. HR_MANAGER/SUPER_ADMIN
 * levels are office-wide by design and resolve to any user with that role.
 */
export async function resolveApproverForRole(
  db: Prisma.TransactionClient | typeof prisma,
  role: string,
  employeeId: string,
  officeId: string
): Promise<string | null> {
  if (role === UserRole.DEPT_MANAGER) {
    const emp = await db.employee.findUnique({ where: { id: employeeId }, select: { reportingToId: true } })
    return emp?.reportingToId ?? null
  }
  if (role === UserRole.DEPT_HEAD) {
    const emp = await db.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } })
    if (!emp) return null
    const dept = await db.department.findUnique({ where: { id: emp.departmentId }, select: { managerId: true } })
    return dept?.managerId ?? null
  }
  const approver = await db.user.findFirst({
    where: { employee: { officeId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } }, role },
    select: { employeeId: true },
  })
  return approver?.employeeId ?? null
}

/**
 * DEPT_HEAD is the top of the normal team-approval chain, so a DEPT_HEAD's
 * (or HR_MANAGER's) own requests escalate instead to whoever holds DEPT_HEAD
 * in the HR department — the designated cross-department authority.
 */
export async function resolveHrDeptHeadApprover(
  db: Prisma.TransactionClient | typeof prisma,
  officeId: string
): Promise<string | null> {
  const hrDept = await db.department.findFirst({ where: { officeId, code: 'HR' }, select: { managerId: true } })
  return hrDept?.managerId ?? null
}

/**
 * Full approver resolution for a team request (leave, late excuse, attendance
 * adjustment): DEPT_HEAD/HR_MANAGER requesters escalate to the HR department
 * head; everyone else resolves to their DEPT_MANAGER (reportingToId), falling
 * back to their own department's DEPT_HEAD if no manager is set.
 */
export async function resolveTeamApprover(
  db: Prisma.TransactionClient | typeof prisma,
  requesterEmployeeId: string,
  requesterRole: string,
  officeId: string
): Promise<string | null> {
  if (requesterRole === UserRole.DEPT_HEAD || requesterRole === UserRole.HR_MANAGER) {
    return resolveHrDeptHeadApprover(db, officeId)
  }
  return (
    (await resolveApproverForRole(db, UserRole.DEPT_MANAGER, requesterEmployeeId, officeId)) ??
    (await resolveApproverForRole(db, UserRole.DEPT_HEAD, requesterEmployeeId, officeId))
  )
}

/**
 * Authorization check for acting on a pending team request (approve/reject a
 * leave application, late excuse, or attendance adjustment). HR_MANAGER is
 * deliberately NOT granted a blanket override here — they can view every
 * pending request office-wide, but only SUPER_ADMIN, the specific resolved
 * approver, or that requester's own department head may act on one.
 */
export async function canActOnTeamRequest(
  db: Prisma.TransactionClient | typeof prisma,
  reviewerId: string,
  reviewerRole: string,
  resolvedApproverId: string | null,
  requesterDepartmentId: string
): Promise<boolean> {
  if (reviewerRole === UserRole.SUPER_ADMIN) return true
  if (resolvedApproverId === reviewerId) return true
  const dept = await db.department.findUnique({ where: { id: requesterDepartmentId }, select: { managerId: true } })
  return dept?.managerId === reviewerId
}
