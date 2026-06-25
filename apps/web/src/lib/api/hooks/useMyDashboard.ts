import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface MyDashboard {
  me: { id: string; firstName: string; lastName: string; avatarUrl?: string | null } | null
  today: {
    status: string
    checkIn: string | null
    checkOut: string | null
    workingMinutes: number
    lateMinutes: number
  } | null
  leaveBalances: Array<{
    code: string
    name: string
    entitled: number
    taken: number
    pending: number
    remaining: number
  }>
  myApplications: Array<{
    id: string
    type: string
    code: string
    startDate: string
    endDate: string
    totalDays: number
    status: string
    createdAt: string
  }>
  attendanceMonth: Array<{
    date: string
    status: string
    checkIn: string | null
    checkOut: string | null
  }>
  team: Array<{
    id: string
    firstName: string
    lastName: string
    avatarUrl?: string | null
    todayStatus: string
    isSelf: boolean
  }>
}

export function useMyDashboard() {
  return useQuery({
    queryKey: ['my-dashboard'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/me')
      return data.data as MyDashboard
    },
  })
}
