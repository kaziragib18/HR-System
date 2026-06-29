import { z } from 'zod'

const salaryComponentSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['ALLOWANCE', 'DEDUCTION']),
  amount: z.number().nonnegative(),
  isPercentage: z.boolean().default(false),
})

export const createSalaryStructureSchema = z.object({
  employeeId: z.string().optional(),
  jobGradeId: z.string().optional(),
  basicSalary: z.number().positive(),
  currency: z.string().length(3),
  components: z.array(salaryComponentSchema).default([]),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(d => d.employeeId || d.jobGradeId, {
  message: 'Either employeeId or jobGradeId must be provided',
})

export const listSalaryQuery = z.object({
  employeeId: z.string().optional(),
  jobGradeId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>
export type ListSalaryQuery = z.infer<typeof listSalaryQuery>
export type SalaryComponent = z.infer<typeof salaryComponentSchema>
