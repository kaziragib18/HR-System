import { z } from 'zod'
import { EmploymentType, EmploymentStatus, UserRole, BloodGroup } from '@hr-system/types'

const addressSchema = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string().optional(),
  postalCode: z.string(),
  country: z.string(),
})

const emergencyContactSchema = z.object({
  name: z.string(),
  phone: z.string(),
  relation: z.string(),
})

const nomineeInfoSchema = z.object({
  name: z.string(),
  relationship: z.string(),
  phone: z.string(),
  nationalId: z.string().optional(),
  address: addressSchema.optional(),
})

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  nationalId: z.string().optional(),
  passportNumber: z.string().optional(),
  officeId: z.string().min(1),
  departmentId: z.string().min(1),
  jobTitleId: z.string().optional(),
  jobGradeId: z.string().optional(),
  reportingToId: z.string().optional(),
  employmentType: z.nativeEnum(EmploymentType),
  role: z.nativeEnum(UserRole).optional(),
  joiningDate: z.string().datetime(),
  probationEndDate: z.string().datetime().optional(),
  presentAddress: addressSchema.optional(),
  permanentAddress: addressSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  isBloodDonor: z.boolean().optional(),
  lastDonationDate: z.string().datetime().optional(),
  nomineeInfo: nomineeInfoSchema.optional(),
})

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
  confirmationDate: z.string().datetime().optional(),
  lastWorkingDay: z.string().datetime().optional(),
  bio: z.string().optional(),
  avatarStoragePath: z.string().optional(),
})

export const bankInfoSchema = z.object({
  bankName: z.string().min(1),
  accountName: z.string().min(1),
  accountNumber: z.string().min(1),
  branchName: z.string().optional(),
  routingNumber: z.string().optional(),
  sortCode: z.string().optional(),
  iban: z.string().optional(),
  swiftCode: z.string().optional(),
  taxId: z.string().optional(),
})

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  departmentId: z.string().optional(),
  officeId: z.string().optional(),
  employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
})

export const listDirectoryQuerySchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  departmentId: z.string().optional(),
  officeId: z.string().optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
})

export const updateEmployeeRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
})

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>
export type BankInfoInput = z.infer<typeof bankInfoSchema>
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>
export type DirectoryQuery = z.infer<typeof listDirectoryQuerySchema>
export type UpdateEmployeeRoleInput = z.infer<typeof updateEmployeeRoleSchema>
