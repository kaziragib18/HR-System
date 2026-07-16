import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface ManagerInfo {
  id: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  jobTitle?: string | null
  relation: string
}

export interface MyDashboard {
  me: {
    id: string
    firstName: string
    lastName: string
    avatarUrl?: string | null
    email?: string | null
    employmentStatus?: string | null
    joiningDate?: string | null
    department?: string | null
    managerName?: string | null
  } | null
  managers: ManagerInfo[]
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
    designation?: string | null
    role?: string | null
  }>
  directReportsCount: number
  departmentHeadcount: number
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
