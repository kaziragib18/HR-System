import { z } from 'zod'

export const applyLeaveSchema = z.object({
  leaveTypeId: z.string(),
  consumeType: z.enum(['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF']).default('FULL_DAY'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: z.string().min(1, 'Location is required').max(100),
  reason: z.string().min(1, 'Reason is required').max(1000),
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

export const cancelLeaveSchema = z.object({
  cancelReason: z.string().min(1).max(500).optional(),
})

export const rejectCancelLeaveSchema = z.object({
  reason: z.string().min(1).max(500),
})

export const updateCancelReasonSchema = z.object({
  cancelReason: z.string().min(1, 'Reason is required').max(500),
})

export const leaveCalendarQuery = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2099),
})

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>
export type RejectLeaveInput = z.infer<typeof rejectLeaveSchema>
export type LeaveApplicationsQuery = z.infer<typeof leaveApplicationsQuery>
export type CancelLeaveInput = z.infer<typeof cancelLeaveSchema>
export type RejectCancelLeaveInput = z.infer<typeof rejectCancelLeaveSchema>
export type UpdateCancelReasonInput = z.infer<typeof updateCancelReasonSchema>
export type LeaveCalendarQuery = z.infer<typeof leaveCalendarQuery>
