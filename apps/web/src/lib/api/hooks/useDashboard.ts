import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface DashboardStats {
  headcount: number
  onProbation: number
  onLeaveToday: number
  lateToday: number
  pendingLeaves: number
}

export interface HeadcountByDept {
  id: string
  department: string
  code: string
  officeCode: string
  count: number
  manager: string | null
  managerTitle: string | null
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
