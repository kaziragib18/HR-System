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
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2020).max(2099).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(31),
})

export type CheckInInput = z.infer<typeof checkInSchema>
export type CheckOutInput = z.infer<typeof checkOutSchema>
export type ManualEntryInput = z.infer<typeof manualEntrySchema>
export type BulkImportInput = z.infer<typeof bulkImportSchema>
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuery>
