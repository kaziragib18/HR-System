'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'

interface HistoryEmployee {
  id: string
  firstName: string
  lastName: string
  employeeId: string
  department?: { id: string; name: string } | null
}

interface HistoryApprover {
  id: string
  firstName: string
  lastName: string
  jobTitle?: { name: string } | null
}

interface LeaveHistoryItem {
  id: string
  type: 'LEAVE'
  action: string
  actionAt: string
  level: number | null
  comment: string | null
  approverId: string
  approver: HistoryApprover | null
  employee: HistoryEmployee
  leaveType: { name: string; code: string }
  startDate: string
  endDate: string
  totalDays: number
}

interface TimesheetHistoryItem {
  id: string
  type: 'TIMESHEET'
  action: 'APPROVED' | 'REJECTED'
  actionAt: string
  level: null
  comment: string | null
  approverId: string
  approver: HistoryApprover | null
  employee: HistoryEmployee
  weekStartDate: string
  weekEndDate: string
  totalMinutes: number
}

interface ExcuseHistoryItem {
  id: string
  type: 'EXCUSE'
  action: 'APPROVED' | 'REJECTED'
  actionAt: string
  level: null
  comment: null
  approverId: string
  approver: HistoryApprover | null
  employee: HistoryEmployee
  date: string
  lateMinutes: number
  lateExcuse: string | null
}

export type ApprovalHistoryItem = LeaveHistoryItem | TimesheetHistoryItem | ExcuseHistoryItem

export function useApprovalHistory(month: number, year: number) {
  return useQuery({
    queryKey: ['approvals', 'history', month, year],
    queryFn: async () => {
      const { data } = await apiClient.get(`/approvals/history?month=${month}&year=${year}`)
      return (data.data ?? []) as ApprovalHistoryItem[]
    },
    staleTime: 30_000,
  })
}
