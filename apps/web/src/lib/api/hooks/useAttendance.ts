'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: string
  lateMinutes: number
  workingMinutes: number
  overtimeMinutes: number
  source: string
  remarks: string | null
  employee?: { id: string; firstName: string; lastName: string; employeeId: string; avatarUrl: string | null }
}

export function useTodayAttendance() {
  return useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: async () => {
      const { data } = await apiClient.get('/attendance/today')
      return (data.data ?? null) as AttendanceRecord | null
    },
    staleTime: 30_000,
  })
}

export function useMyMonthAttendance(month: number, year: number) {
  return useQuery({
    queryKey: ['attendance', 'me', month, year],
    queryFn: async () => {
      const { data } = await apiClient.get(`/attendance/me?month=${month}&year=${year}`)
      return (data.data ?? []) as AttendanceRecord[]
    },
    staleTime: 60_000,
  })
}

export function useCheckIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (remarks?: string) => {
      const { data } = await apiClient.post('/attendance/check-in', { remarks })
      return data.data as AttendanceRecord
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'today'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'me'] })
    },
  })
}

export function useCheckOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (remarks?: string) => {
      const { data } = await apiClient.post('/attendance/check-out', { remarks })
      return data.data as AttendanceRecord
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'today'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'me'] })
    },
  })
}
