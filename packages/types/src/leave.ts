import { LeaveStatus } from './enums'

export interface LeaveTypeInfo {
  id: string
  officeId: string
  name: string
  code: string
  daysPerYear: number
  isPaid: boolean
  isCarryForward: boolean
  maxCarryForward?: number | null
  requiresApproval: boolean
  minNoticeDays: number
  maxConsecutiveDays?: number | null
  isActive: boolean
  approvalChain: ApprovalChainLevel[]
}

export interface ApprovalChainLevel {
  level: number
  role: string
}

export interface LeaveBalance {
  leaveType: { id: string; name: string; code: string }
  year: number
  entitled: number
  taken: number
  pending: number
  carriedForward: number
  remaining: number
}

export interface LeaveApplication {
  id: string
  employee: { id: string; firstName: string; lastName: string; employeeId: string }
  leaveType: { id: string; name: string; code: string; isPaid: boolean }
  startDate: string
  endDate: string
  totalDays: number
  reason?: string | null
  status: LeaveStatus
  approvalLevel: number
  currentApprover?: { id: string; firstName: string; lastName: string } | null
  approvedBy?: { id: string; firstName: string; lastName: string } | null
  approvedAt?: string | null
  rejectedBy?: { id: string; firstName: string; lastName: string } | null
  rejectionReason?: string | null
  attachmentUrl?: string | null
  approvalHistory: LeaveApprovalHistoryItem[]
  createdAt: string
}

export interface LeaveApprovalHistoryItem {
  id: string
  approver: { id: string; firstName: string; lastName: string }
  action: 'APPROVED' | 'REJECTED' | 'FORWARDED'
  level: number
  comment?: string | null
  createdAt: string
}

export interface ApplyLeaveRequest {
  leaveTypeId: string
  startDate: string
  endDate: string
  reason?: string
  attachmentStoragePath?: string
}

export interface ApproveLeaveRequest {
  comment?: string
}

export interface RejectLeaveRequest {
  reason: string
}
