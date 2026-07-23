import { EmploymentStatus, EmploymentType, SkillLevel, IdentificationType, DocumentType, BloodGroup } from './enums'

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
  bloodGroup?: BloodGroup | null
  department: { id: string; name: string }
  jobTitle?: { id: string; name: string } | null
  jobGrade?: { id: string; name: string } | null
  reportingTo?: { id: string; firstName: string; lastName: string } | null
  office: { id: string; code: string; name: string; currency: string }
  user?: { role: string; isActive: boolean } | null
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
  isBloodDonor?: boolean
  lastDonationDate?: string | null
  nomineeInfo?: NomineeInfo | null
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

export interface NomineeInfo {
  name: string
  relationship: string
  phone: string
  nationalId?: string
  address?: Address
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
  bloodGroup?: BloodGroup
  isBloodDonor?: boolean
  lastDonationDate?: string
  nomineeInfo?: NomineeInfo
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  employmentStatus?: EmploymentStatus
  confirmationDate?: string
  lastWorkingDay?: string
  bio?: string
}

// ─── Profile sections ──────────────────────────────────────────────────────

export interface WorkExperience {
  id: string
  employeeId: string
  companyName: string
  jobTitle: string
  location?: string | null
  startDate: string
  endDate?: string | null
  isCurrent: boolean
  description?: string | null
}
export type CreateWorkExperienceRequest = Omit<WorkExperience, 'id' | 'employeeId'>
export type UpdateWorkExperienceRequest = Partial<CreateWorkExperienceRequest>

export interface Education {
  id: string
  employeeId: string
  institution: string
  degree: string
  fieldOfStudy?: string | null
  startDate: string
  endDate?: string | null
  grade?: string | null
  description?: string | null
}
export type CreateEducationRequest = Omit<Education, 'id' | 'employeeId'>
export type UpdateEducationRequest = Partial<CreateEducationRequest>

export interface EmployeeSkill {
  id: string
  employeeId: string
  name: string
  level: SkillLevel
  yearsOfExperience?: number | null
}
export type CreateEmployeeSkillRequest = Omit<EmployeeSkill, 'id' | 'employeeId'>
export type UpdateEmployeeSkillRequest = Partial<Omit<CreateEmployeeSkillRequest, 'name'>>

export interface ContactBookEntry {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  avatarUrl?: string | null
  bloodGroup?: BloodGroup | null
  department: { id: string; name: string }
  jobTitle?: { name: string } | null
}

export interface DocumentSummary {
  id: string
  name: string
  type: DocumentType
  fileMime: string
  fileSizeBytes: number
  createdAt: string
}

export interface Certification {
  id: string
  employeeId: string
  name: string
  issuingOrganization: string
  issueDate: string
  expiryDate?: string | null
  credentialId?: string | null
  credentialUrl?: string | null
  documentId?: string | null
  document?: DocumentSummary | null
}
export type CreateCertificationRequest = Omit<Certification, 'id' | 'employeeId' | 'documentId' | 'document'>
export type UpdateCertificationRequest = Partial<CreateCertificationRequest>

export interface Identification {
  id: string
  employeeId: string
  type: IdentificationType
  documentNumber: string
  issuingAuthority?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  documentId?: string | null
  document?: DocumentSummary | null
}
export type CreateIdentificationRequest = Omit<Identification, 'id' | 'employeeId' | 'documentId' | 'document'>
export type UpdateIdentificationRequest = Partial<CreateIdentificationRequest>
