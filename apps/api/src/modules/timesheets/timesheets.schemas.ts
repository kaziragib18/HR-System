import { z } from 'zod'

export const rejectTimesheetSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
})

export const approveTimesheetSchema = z.object({
  comment: z.string().max(500).optional(),
})

export const listTimesheetsQuery = z.object({
  employeeId: z.string().optional(),
  status: z.string().optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2020).max(2099).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export type RejectTimesheetInput = z.infer<typeof rejectTimesheetSchema>
export type ApproveTimesheetInput = z.infer<typeof approveTimesheetSchema>
export type ListTimesheetsQuery = z.infer<typeof listTimesheetsQuery>
