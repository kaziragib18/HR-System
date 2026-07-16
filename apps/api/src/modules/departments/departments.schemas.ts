import { z } from 'zod'
import { UserRole } from '@hr-system/types'

export const createDepartmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  officeId: z.string().min(1),
  parentId: z.string().optional(),
  managerId: z.string().optional(),
})

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const assignManagerSchema = z.object({
  managerId: z.string().min(1),
})

export const appointRoleSchema = z.object({
  employeeId: z.string().min(1),
  role: z.enum([UserRole.DEPT_HEAD, UserRole.DEPT_MANAGER]),
})

export const dismissRoleSchema = z.object({
  employeeId: z.string().min(1),
})

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>
export type AssignManagerInput = z.infer<typeof assignManagerSchema>
export type AppointRoleInput = z.infer<typeof appointRoleSchema>
export type DismissRoleInput = z.infer<typeof dismissRoleSchema>
