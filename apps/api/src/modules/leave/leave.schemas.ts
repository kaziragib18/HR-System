import { z } from 'zod'

export const applyLeaveSchema = z.object({
  leaveTypeId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(1000).optional(),
  attachmentPath: z.string().optional(),
})

export const approveLeaveSchema = z.object({
  comment: z.string().max(500).optional(),
})

export const rejectLeaveSchema = z.object({
  rejectionReason: z.string().min(1).max(500),
})

export const leaveApplicationsQuery = z.object({
  employeeId: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const leaveCalendarQuery = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2099),
})

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>
export type RejectLeaveInput = z.infer<typeof rejectLeaveSchema>
export type LeaveApplicationsQuery = z.infer<typeof leaveApplicationsQuery>
export type LeaveCalendarQuery = z.infer<typeof leaveCalendarQuery>
