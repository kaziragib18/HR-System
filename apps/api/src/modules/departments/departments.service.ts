import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { UserRole } from '@hr-system/types'
import type { CreateDepartmentInput, UpdateDepartmentInput } from './departments.schemas'

export class DepartmentError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

export async function listDepartments(officeScope: string | undefined) {
  const where: Prisma.DepartmentWhereInput = {
    isActive: true,
    ...(officeScope ? { officeId: officeScope } : {}),
  }
  return prisma.department.findMany({
    where,
    include: {
      office: { select: { id: true, code: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      // The department's role holders (head + manager), derived from User.role —
      // this is what the card renders. Kept in sync with managerId on appoint.
      employees: {
        where: {
          employmentStatus: { not: 'TERMINATED' },
          user: { role: { in: [UserRole.DEPT_HEAD, UserRole.DEPT_MANAGER] } },
        },
        select: {
          id: true, firstName: true, lastName: true, avatarUrl: true,
          user: { select: { role: true } },
        },
        orderBy: { firstName: 'asc' },
      },
      jobTitles: { where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } },
      // Only count non-terminated employees — terminated employees should not block deletion
      _count: { select: { employees: { where: { employmentStatus: { not: 'TERMINATED' } } } } },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getDepartmentTree(officeScope: string | undefined) {
  const depts = await listDepartments(officeScope)
  type Node = (typeof depts)[number] & { children: Node[] }
  const map = new Map<string, Node>()
  const roots: Node[] = []
  depts.forEach((d) => map.set(d.id, { ...d, children: [] }))
  map.forEach((node) => {
    const parentId = (node as unknown as { parentId: string | null }).parentId
    if (parentId && map.has(parentId)) map.get(parentId)!.children.push(node)
    else roots.push(node)
  })
  return roots
}

export async function getDepartment(id: string, officeScope: string | undefined) {
  const dept = await prisma.department.findUnique({
    where: { id },
    include: {
      office: { select: { id: true, code: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { employees: true } },
    },
  })
  if (!dept) throw new DepartmentError('Department not found', 404)
  if (officeScope && dept.officeId !== officeScope) throw new DepartmentError('Department not found', 404)
  return dept
}

export async function createDepartment(data: CreateDepartmentInput) {
  const existing = await prisma.department.findFirst({ where: { officeId: data.officeId, code: data.code } })
  if (existing) throw new DepartmentError('A department with this code already exists in this office', 409)
  return prisma.department.create({ data })
}

export async function updateDepartment(id: string, officeScope: string | undefined, data: UpdateDepartmentInput) {
  const dept = await getDepartment(id, officeScope)

  if (data.code) {
    const effectiveOfficeId = data.officeId ?? dept.officeId
    const conflict = await prisma.department.findFirst({
      where: { officeId: effectiveOfficeId, code: data.code, id: { not: id } },
    })
    if (conflict) throw new DepartmentError('A department with this code already exists in this office', 409)
  }

  return prisma.department.update({ where: { id }, data })
}

export async function deactivateDepartment(id: string, officeScope: string | undefined) {
  await getDepartment(id, officeScope)

  // Only active (non-terminated) employees block deletion
  const activeCount = await prisma.employee.count({
    where: { departmentId: id, employmentStatus: { not: 'TERMINATED' } },
  })
  if (activeCount > 0) {
    throw new DepartmentError(
      `Cannot delete: ${activeCount} active ${activeCount === 1 ? 'employee' : 'employees'} must be transferred to another department first`,
      409
    )
  }

  return prisma.department.update({ where: { id }, data: { isActive: false } })
}

export async function listMembers(id: string, officeScope: string | undefined) {
  await getDepartment(id, officeScope)
  return prisma.employee.findMany({
    where: { departmentId: id, employmentStatus: { not: 'TERMINATED' } },
    select: {
      id: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      jobTitle: { select: { name: true } },
      jobGrade: { select: { name: true } },
      user: { select: { role: true } },
    },
    orderBy: { firstName: 'asc' },
  })
}

export async function assignManager(id: string, officeScope: string | undefined, managerId: string) {
  await getDepartment(id, officeScope)
  const manager = await prisma.employee.findUnique({ where: { id: managerId } })
  if (!manager) throw new DepartmentError('Manager (employee) not found', 404)
  return prisma.department.update({ where: { id }, data: { managerId } })
}

/**
 * Appoint a department Head or Manager from the department card. Unlike the
 * legacy assignManager (managerId only), this also switches the person's
 * User.role — and for a Head, keeps Department.managerId in sync. Enforces:
 * exactly one Head and one Manager per department, target must belong to the
 * department, and admins (HR_MANAGER/SUPER_ADMIN) can't be re-roled from here.
 */
export async function appointDeptRole(
  id: string,
  officeScope: string | undefined,
  employeeId: string,
  role: UserRole.DEPT_HEAD | UserRole.DEPT_MANAGER
) {
  await getDepartment(id, officeScope)

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, departmentId: true, officeId: true, user: { select: { role: true } } },
  })
  if (!employee) throw new DepartmentError('Employee not found', 404)
  if (officeScope && employee.officeId !== officeScope) throw new DepartmentError('Employee not found', 404)
  if (employee.departmentId !== id) {
    throw new DepartmentError('You can only appoint someone who belongs to this department', 400)
  }

  const currentRole = employee.user?.role
  if (currentRole === UserRole.SUPER_ADMIN || currentRole === UserRole.HR_MANAGER) {
    throw new DepartmentError('This person is an admin — change their role from Settings → Roles instead', 400)
  }

  // Exactly one Head and one Manager per department.
  const conflict = await prisma.user.findFirst({
    where: { role, isActive: true, employeeId: { not: employeeId }, employee: { departmentId: id } },
    select: { employeeId: true },
  })
  if (conflict) {
    const label = role === UserRole.DEPT_HEAD ? 'department head' : 'department manager'
    throw new DepartmentError(`This department already has a ${label}. Remove the current one first.`, 400)
  }

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { employeeId }, data: { role } })
    // The Head is also recorded as Department.managerId (used by dashboards and
    // approver resolution) — keep the two in sync.
    if (role === UserRole.DEPT_HEAD) {
      await tx.department.update({ where: { id }, data: { managerId: employeeId } })
    }
    return tx.department.findUnique({ where: { id } })
  })
}

/**
 * Remove a Head or Manager appointment: resets the person's role to EMPLOYEE
 * and, if they were the recorded Head (managerId), clears that too.
 */
export async function dismissDeptRole(id: string, officeScope: string | undefined, employeeId: string) {
  await getDepartment(id, officeScope)

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, departmentId: true, officeId: true, user: { select: { role: true } } },
  })
  if (!employee) throw new DepartmentError('Employee not found', 404)
  if (officeScope && employee.officeId !== officeScope) throw new DepartmentError('Employee not found', 404)
  if (employee.departmentId !== id) {
    throw new DepartmentError('This person does not belong to this department', 400)
  }

  const currentRole = employee.user?.role
  if (currentRole !== UserRole.DEPT_HEAD && currentRole !== UserRole.DEPT_MANAGER) {
    throw new DepartmentError('This person is not a department head or manager', 400)
  }

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { employeeId }, data: { role: UserRole.EMPLOYEE } })
    const dept = await tx.department.findUnique({ where: { id }, select: { managerId: true } })
    if (dept?.managerId === employeeId) {
      await tx.department.update({ where: { id }, data: { managerId: null } })
    }
    return tx.department.findUnique({ where: { id } })
  })
}
