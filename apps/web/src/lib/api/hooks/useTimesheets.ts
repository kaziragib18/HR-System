'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface TimesheetEntry {
  id: string
  date: string
  checkIn: string | null
  checkOut: string | null
  workMinutes: number
  projectCode: string | null
  notes: string | null
}

export interface Timesheet {
  id: string
  employeeId: string
  weekStartDate: string
  weekEndDate: string
  totalMinutes: number
  overtimeMinutes: number
  status: string
  submittedAt: string | null
  approvedAt: string | null
  rejectionReason: string | null
  entries: TimesheetEntry[]
  employee?: { id: string; firstName: string; lastName: string; employeeId: string }
}

export function useMyTimesheets(month?: number, year?: number) {
  return useQuery({
    queryKey: ['timesheets', 'me', month, year],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (month) params.set('month', String(month))
      if (year) params.set('year', String(year))
      const { data } = await apiClient.get(`/timesheets/me?${params}`)
      return (data.data ?? []) as Timesheet[]
    },
    staleTime: 30_000,
  })
}

export function useTimesheet(id: string) {
  return useQuery({
    queryKey: ['timesheets', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/timesheets/${id}`)
      return data.data as Timesheet
    },
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useGenerateTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/timesheets/generate')
      return data.data as Timesheet
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets', 'me'] }),
  })
}

export function useSubmitTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/timesheets/${id}/submit`)
      return data.data as Timesheet
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  })
}

export function useApproveTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/timesheets/${id}/approve`)
      return data.data as Timesheet
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  })
}

export function useRejectTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: string; rejectionReason: string }) => {
      const { data } = await apiClient.post(`/timesheets/${id}/reject`, { rejectionReason })
      return data.data as Timesheet
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  })
}

export function useAllTimesheets(params?: { status?: string; month?: number; year?: number }) {
  return useQuery({
    queryKey: ['timesheets', 'all', params],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (params?.status) p.set('status', params.status)
      if (params?.month) p.set('month', String(params.month))
      if (params?.year) p.set('year', String(params.year))
      const { data } = await apiClient.get(`/timesheets?${p}`)
      return (data.data ?? []) as Timesheet[]
    },
    staleTime: 30_000,
  })
}
