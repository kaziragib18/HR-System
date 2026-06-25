import { EmploymentStatus, EmploymentType } from './enums'

export interface EmployeeListItem {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  avatarUrl?: string | null
  employmentType: EmploymentType
  employmentStatus: EmploymentStatus
  joiningDate: string
  department: { id: string; name: string }
  jobTitle?: { id: string; name: string } | null
  jobGrade?: { id: string; name: string } | null
  reportingTo?: { id: string; firstName: string; lastName: string } | null
  office: { id: string; code: string; name: string }
}

export interface EmployeeProfile extends EmployeeListItem {
  dateOfBirth?: string | null
  gender?: string | null
  nationality?: string | null
  nationalId?: string | null
  passportNumber?: string | null
  presentAddress?: Address | null
  permanentAddress?: Address | null
  emergencyContact?: EmergencyContact | null
  bio?: string | null
  confirmationDate?: string | null
  probationEndDate?: string | null
  lastWorkingDay?: string | null
}

export interface Address {
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string
}

export interface EmergencyContact {
  name: string
  phone: string
  relation: string
}

export interface BankInfo {
  id: string
  bankName: string
  accountName: string
  accountNumber: string
  branchName?: string | null
  routingNumber?: string | null
  sortCode?: string | null
  iban?: string | null
  swiftCode?: string | null
  taxId?: string | null
}

export interface CreateEmployeeRequest {
  firstName: string
  lastName: string
  email: string
  phone?: string
  dateOfBirth?: string
  gender?: string
  nationality?: string
  nationalId?: string
  passportNumber?: string
  officeId: string
  departmentId: string
  jobTitleId?: string
  jobGradeId?: string
  reportingToId?: string
  employmentType: EmploymentType
  joiningDate: string
  probationEndDate?: string
  presentAddress?: Address
  permanentAddress?: Address
  emergencyContact?: EmergencyContact
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  employmentStatus?: EmploymentStatus
  confirmationDate?: string
  lastWorkingDay?: string
  bio?: string
}
