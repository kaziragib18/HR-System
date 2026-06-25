import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface DashboardStats {
  headcount: number
  onProbation: number
  onLeaveToday: number
  lateToday: number
  pendingLeaves: number
  openTimesheets: number
}

export interface HeadcountByDept {
  department: string
  count: number
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/stats')
      return data.data as DashboardStats
    },
  })
}

export function useHeadcountByDepartment() {
  return useQuery({
    queryKey: ['headcount-by-department'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/headcount-by-department')
      return data.data as HeadcountByDept[]
    },
  })
}
