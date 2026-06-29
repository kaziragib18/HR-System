import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
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
  const existing = await prisma.department.findUnique({ where: { code: data.code } })
  if (existing) throw new DepartmentError('A department with this code already exists', 409)
  return prisma.department.create({ data })
}

export async function updateDepartment(id: string, officeScope: string | undefined, data: UpdateDepartmentInput) {
  await getDepartment(id, officeScope)
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
