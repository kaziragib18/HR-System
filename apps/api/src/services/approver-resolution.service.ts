import type { Prisma } from '@prisma/client'
import { prisma } from '../config/prisma'
import { UserRole } from '@hr-system/types'

/**
 * Resolves the correct approver for a given chain-level role and employee.
 * TEAM_LEAD/DEPT_HEAD levels route to the employee's actual manager/department
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
  if (role === UserRole.TEAM_LEAD) {
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
