import { z } from 'zod'

export const createPayrollRunSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2099),
})

export const listPayrollRunsQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const myPayslipsQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(12),
})

export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>
export type ListPayrollRunsQuery = z.infer<typeof listPayrollRunsQuery>
export type MyPayslipsQuery = z.infer<typeof myPayslipsQuery>
