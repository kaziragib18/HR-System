export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  HR_MANAGER = 'HR_MANAGER',
  DEPT_HEAD = 'DEPT_HEAD',
  DEPT_MANAGER = 'DEPT_MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export enum OfficeLocation {
  BD = 'BD',
  UK = 'UK',
}

export enum Currency {
  BDT = 'BDT',
  GBP = 'GBP',
}

export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERN = 'INTERN',
}

export enum EmploymentStatus {
  ACTIVE = 'ACTIVE',
  PROBATION = 'PROBATION',
  NOTICE_PERIOD = 'NOTICE_PERIOD',
  TERMINATED = 'TERMINATED',
  ON_LEAVE = 'ON_LEAVE',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
}

export enum LeaveConsumeType {
  FULL_DAY = 'FULL_DAY',
  FIRST_HALF = 'FIRST_HALF',
  SECOND_HALF = 'SECOND_HALF',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EARLY_DEPARTURE = 'EARLY_DEPARTURE',
  HALF_DAY = 'HALF_DAY',
  ON_LEAVE = 'ON_LEAVE',
  HOLIDAY = 'HOLIDAY',
  WEEKEND = 'WEEKEND',
}

export enum AttendanceSource {
  BIOMETRIC = 'BIOMETRIC',
  RFID = 'RFID',
  MANUAL = 'MANUAL',
  SELF = 'SELF',
  SYSTEM = 'SYSTEM',
}

export enum PayrollStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
}

export enum DocumentType {
  OFFER_LETTER = 'OFFER_LETTER',
  NDA = 'NDA',
  CONTRACT = 'CONTRACT',
  ID_PROOF = 'ID_PROOF',
  PAYSLIP = 'PAYSLIP',
  CERTIFICATE = 'CERTIFICATE',
  OTHER = 'OTHER',
}

export enum NotificationType {
  LEAVE_REQUESTED = 'LEAVE_REQUESTED',
  LEAVE_APPROVED = 'LEAVE_APPROVED',
  LEAVE_REJECTED = 'LEAVE_REJECTED',
  LEAVE_CANCELLED = 'LEAVE_CANCELLED',
  LEAVE_CANCEL_REQUESTED = 'LEAVE_CANCEL_REQUESTED',
  LEAVE_CANCEL_APPROVED = 'LEAVE_CANCEL_APPROVED',
  LEAVE_CANCEL_REJECTED = 'LEAVE_CANCEL_REJECTED',
  PAYSLIP_READY = 'PAYSLIP_READY',
  ATTENDANCE_FLAGGED = 'ATTENDANCE_FLAGGED',
  ATTENDANCE_ADJUSTMENT_REQUESTED = 'ATTENDANCE_ADJUSTMENT_REQUESTED',
  ATTENDANCE_ADJUSTMENT_APPROVED = 'ATTENDANCE_ADJUSTMENT_APPROVED',
  ATTENDANCE_ADJUSTMENT_REJECTED = 'ATTENDANCE_ADJUSTMENT_REJECTED',
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  ONBOARDING_TASK = 'ONBOARDING_TASK',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  PERFORMANCE_REVIEW = 'PERFORMANCE_REVIEW',
}

export enum OnboardingTaskCategory {
  DOCUMENT = 'DOCUMENT',
  IT_SETUP = 'IT_SETUP',
  TRAINING = 'TRAINING',
  COMPLIANCE = 'COMPLIANCE',
  ASSET = 'ASSET',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export enum TaxRegime {
  BD_INCOME_TAX = 'BD_INCOME_TAX',
  UK_PAYE = 'UK_PAYE',
}

export enum SkillLevel {
  BEGINNER = 'BEGINNER',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT',
}

export enum IdentificationType {
  NATIONAL_ID = 'NATIONAL_ID',
  PASSPORT = 'PASSPORT',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  OTHER = 'OTHER',
}

export enum BloodGroup {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
}

/** Named theme variants offered on the Appearance settings tab — keep in sync with apps/web/src/lib/theme.ts's swatch labels/gradients. */
export const LIGHT_THEMES = ['light', 'forest', 'ocean', 'ice-age', 'desert', 'autumn', 'blossom'] as const
export const DARK_THEMES = ['dark', 'midnight', 'amoled', 'mocha', 'slate', 'dracula', 'monochrome'] as const
export const THEME_VALUES = [...LIGHT_THEMES, ...DARK_THEMES] as const
export type Theme = (typeof THEME_VALUES)[number]

export enum AnnouncementCategory {
  GENERAL = 'GENERAL',
  OFFICE_CLOSURE = 'OFFICE_CLOSURE',
  OTHER = 'OTHER',
  // Automated — computed at read time, never created via the manual-post endpoint.
  NEW_JOINEE = 'NEW_JOINEE',
  BIRTHDAY = 'BIRTHDAY',
  WORK_ANNIVERSARY = 'WORK_ANNIVERSARY',
  POLICY_DOCUMENT = 'POLICY_DOCUMENT',
  UPCOMING_HOLIDAY = 'UPCOMING_HOLIDAY',
}

/** Categories an admin can pick when authoring a manual announcement. */
export const MANUAL_ANNOUNCEMENT_CATEGORIES = [
  AnnouncementCategory.GENERAL,
  AnnouncementCategory.OFFICE_CLOSURE,
  AnnouncementCategory.OTHER,
] as const
