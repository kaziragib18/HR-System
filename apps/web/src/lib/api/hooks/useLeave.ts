'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface LeaveType {
  id: string
  name: string
  code: string
  daysPerYear: number
  isPaid: boolean
  isCarryForward: boolean
  requiresApproval: boolean
  minNoticeDays: number
  approvalChain: Array<{ level: number; role: string }>
}

export interface LeaveBalance {
  id: string
  leaveTypeId: string
  year: number
  entitled: number
  taken: number
  pending: number
  carriedForward: number
  leaveType: { id: string; name: string; code: string; isPaid: boolean }
}

export interface LeaveApprovalHistory {
  id: string
  approverId: string
  action: string
  level: number
  comment: string | null
  createdAt: string
  approver?: { id: string; firstName: string; lastName: string; jobTitle?: { name: string } | null } | null
}

export interface LeaveApplication {
  id: string
  employeeId: string
  leaveTypeId: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string | null
  status: string
  approvalLevel: number
  cancelReason: string | null
  cancelRequestedAt: string | null
  createdAt: string
  employee?: {
    id: string; firstName: string; lastName: string; employeeId: string; avatarUrl: string | null
    department?: { id: string; name: string } | null
    user?: { role: string } | null
  }
  leaveType?: { id: string; name: string; code: string }
  approvalHistory?: LeaveApprovalHistory[]
}

export interface ApplyLeavePayload {
  leaveTypeId: string
  consumeType: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'
  startDate: string
  endDate: string
  location: string
  reason: string
  attachmentPath?: string
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave', 'types'],
    queryFn: async () => {
      const { data } = await apiClient.get('/leave/types')
      return (data.data ?? []) as LeaveType[]
    },
    staleTime: 5 * 60_000,
  })
}

export function useLeaveBalances(year?: number) {
  const y = year ?? new Date().getFullYear()
  return useQuery({
    queryKey: ['leave', 'balances', y],
    queryFn: async () => {
      const { data } = await apiClient.get(`/leave/balances?year=${y}`)
      return (data.data ?? []) as LeaveBalance[]
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}

export function useMyLeaveApplications(status?: string) {
  return useQuery({
    queryKey: ['leave', 'applications', 'me', status],
    queryFn: async () => {
      const { data } = await apiClient.get(`/leave/applications?self=true${status ? `&status=${status}` : ''}`)
      return (data.data ?? []) as LeaveApplication[]
    },
    staleTime: 30_000,
  })
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['leave', 'applications', 'pending'],
    queryFn: async () => {
      const { data } = await apiClient.get('/leave/applications/pending')
      return (data.data ?? []) as LeaveApplication[]
    },
    staleTime: 30_000,
  })
}

export function useApplyLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ApplyLeavePayload) => {
      const { data } = await apiClient.post('/leave/applications', payload)
      return data.data as LeaveApplication
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] })
      qc.invalidateQueries({ queryKey: ['my-dashboard'] })
      qc.invalidateQueries({ queryKey: ['attendance', 'calendar'] })
    },
  })
}

export function useUploadLeaveAttachment() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const form = new FormData()
      form.append('file', file)
      const { data } = await apiClient.post('/leave/attachments', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data.path as string
    },
  })
}

export function useApproveLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { data } = await apiClient.patch(`/leave/applications/${id}/approve`, { comment })
      return data.data as LeaveApplication
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] })
      qc.invalidateQueries({ queryKey: ['attendance', 'calendar'] })
      qc.invalidateQueries({ queryKey: ['my-dashboard'] })
    },
  })
}

export function useRejectLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: string; rejectionReason: string }) => {
      const { data } = await apiClient.patch(`/leave/applications/${id}/reject`, { rejectionReason })
      return data.data as LeaveApplication
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] })
      qc.invalidateQueries({ queryKey: ['attendance', 'calendar'] })
    },
  })
}

export function useCancelLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, cancelReason }: { id: string; cancelReason?: string }) => {
      const { data } = await apiClient.patch(`/leave/applications/${id}/cancel`, { cancelReason })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] })
      qc.invalidateQueries({ queryKey: ['my-dashboard'] })
      qc.invalidateQueries({ queryKey: ['attendance', 'calendar'] })
    },
  })
}

export function useApproveCancelLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/leave/applications/${id}/cancel-approve`)
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] })
      qc.invalidateQueries({ queryKey: ['attendance', 'calendar'] })
      qc.invalidateQueries({ queryKey: ['my-dashboard'] })
    },
  })
}

export function useRejectCancelLeave() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await apiClient.patch(`/leave/applications/${id}/cancel-reject`, { reason })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] })
      qc.invalidateQueries({ queryKey: ['attendance', 'calendar'] })
    },
  })
}

export function useUpdateCancelReason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, cancelReason }: { id: string; cancelReason: string }) => {
      const { data } = await apiClient.patch(`/leave/applications/${id}/cancel-reason`, { cancelReason })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave'] })
    },
  })
}
