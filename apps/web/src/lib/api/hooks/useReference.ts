import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface JobGrade {
  id: string
  name: string
  band: string
  level: number
  officeId: string
}

export interface JobTitle {
  id: string
  name: string
  department?: { name: string } | null
}

export function useJobGrades() {
  return useQuery({
    queryKey: ['job-grades'],
    queryFn: async () => {
      const { data } = await apiClient.get('/job-grades')
      return data.data as JobGrade[]
    },
  })
}

export function useJobTitles() {
  return useQuery({
    queryKey: ['job-titles'],
    queryFn: async () => {
      const { data } = await apiClient.get('/job-grades/titles')
      return data.data as JobTitle[]
    },
  })
}
