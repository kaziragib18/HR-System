import { z } from 'zod'

export const checkInSchema = z.object({
  remarks: z.string().max(500).optional(),
})

export const checkOutSchema = z.object({
  remarks: z.string().max(500).optional(),
})

export const manualEntrySchema = z.object({
  employeeId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  checkIn: z.string().datetime().optional().nullable(),
  checkOut: z.string().datetime().optional().nullable(),
  remarks: z.string().max(500).optional(),
})

export const bulkImportSchema = z.object({
  records: z.array(
    z.object({
      employeeId: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      checkIn: z.string().datetime().optional().nullable(),
      checkOut: z.string().datetime().optional().nullable(),
      deviceId: z.string().optional(),
      source: z.enum(['BIOMETRIC', 'RFID']).default('BIOMETRIC'),
    })
  ).min(1).max(500),
})

export const listAttendanceQuery = z.object({
  employeeId: z.string().optional(),
  departmentId: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2020).max(2099).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(2000).default(31),
})

export const calendarQuery = z.object({
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2020).max(2099).optional(),
})

export const lateExcuseSchema = z.object({
  excuse: z.string().min(5).max(1000),
})

export const reviewExcuseSchema = z.object({
  approved: z.boolean(),
  newStatus: z.string().optional(),  // e.g. "PRESENT" when approving
})

export const requestAdjustmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  requestedCheckIn: z.string().datetime().optional(),
  requestedCheckOut: z.string().datetime().optional(),
  reason: z.string().min(5).max(1000),
}).refine(d => d.requestedCheckIn || d.requestedCheckOut, {
  message: 'Provide a proposed check-in or check-out time',
})

export const reviewAdjustmentSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().max(500).optional(),
})

export type CheckInInput = z.infer<typeof checkInSchema>
export type CheckOutInput = z.infer<typeof checkOutSchema>
export type ManualEntryInput = z.infer<typeof manualEntrySchema>
export type BulkImportInput = z.infer<typeof bulkImportSchema>
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuery>
export type CalendarQuery = z.infer<typeof calendarQuery>
export type LateExcuseInput = z.infer<typeof lateExcuseSchema>
export type ReviewExcuseInput = z.infer<typeof reviewExcuseSchema>
export type RequestAdjustmentInput = z.infer<typeof requestAdjustmentSchema>
export type ReviewAdjustmentInput = z.infer<typeof reviewAdjustmentSchema>
