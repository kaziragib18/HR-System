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
  lateExcuse: string | null
  excuseStatus: string | null
  employee?: { id: string; firstName: string; lastName: string; employeeId: string; avatarUrl: string | null }
}

export interface CalendarRecord {
  id: string
  date: string
  status: string
  checkIn: string | null
  checkOut: string | null
  lateMinutes: number
  workingMinutes: number
  lateExcuse: string | null
  excuseStatus: string | null
}

export interface CalendarLeave {
  id: string
  startDate: string
  endDate: string
  type: string
  code: string
  status: string
  reason: string | null
}

export interface AttendanceCalendarData {
  records: CalendarRecord[]
  leaves: CalendarLeave[]
  officeStartTime: string
  officeEndTime: string
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
      qc.invalidateQueries({ queryKey: ['my-dashboard'] })
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
      qc.invalidateQueries({ queryKey: ['my-dashboard'] })
    },
  })
}

export function useAttendanceCalendar(month: number, year: number) {
  return useQuery({
    queryKey: ['attendance', 'calendar', month, year],
    queryFn: async () => {
      const { data } = await apiClient.get(`/attendance/me/calendar?month=${month}&year=${year}`)
      return data.data as AttendanceCalendarData
    },
    staleTime: 0,            // always re-fetch when query becomes active
    refetchOnWindowFocus: true,
  })
}

export function useSubmitLateExcuse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, excuse }: { id: string; excuse: string }) => {
      const { data } = await apiClient.patch(`/attendance/me/${id}/late-excuse`, { excuse })
      return data.data as AttendanceRecord
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'calendar'] })
      qc.invalidateQueries({ queryKey: ['my-dashboard'] })
    },
  })
}

export function usePendingExcuses() {
  return useQuery({
    queryKey: ['attendance', 'late-excuses'],
    queryFn: async () => {
      const { data } = await apiClient.get('/attendance/late-excuses')
      return data.data as (AttendanceRecord & { employee: NonNullable<AttendanceRecord['employee']> })[]
    },
    staleTime: 30_000,
  })
}

export function useReviewExcuse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, approved, newStatus }: { id: string; approved: boolean; newStatus?: string }) => {
      const { data } = await apiClient.patch(`/attendance/${id}/review-excuse`, { approved, newStatus })
      return data.data as AttendanceRecord
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance', 'late-excuses'] })
      qc.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}
