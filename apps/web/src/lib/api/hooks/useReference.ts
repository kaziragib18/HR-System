import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface Office {
  id: string
  code: string
  name: string
  isActive: boolean
}

export function useOffices() {
  return useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data } = await apiClient.get('/company/offices')
      return data.data as Office[]
    },
  })
}

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
  departmentId?: string | null
  department?: { id: string; name: string } | null
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

export function useJobTitles(departmentId?: string) {
  return useQuery({
    queryKey: ['job-titles', departmentId ?? 'all'],
    queryFn: async () => {
      const qs = departmentId ? `?departmentId=${departmentId}` : ''
      const { data } = await apiClient.get(`/job-grades/titles${qs}`)
      return data.data as JobTitle[]
    },
  })
}

export function useCreateJobTitle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; departmentId?: string }) => {
      const { data } = await apiClient.post('/job-grades/titles', payload)
      return data.data as JobTitle
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-titles'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
    },
  })
}

export function useUpdateJobTitle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data } = await apiClient.patch(`/job-grades/titles/${id}`, { name })
      return data.data as JobTitle
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-titles'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
    },
  })
}

export function useDeleteJobTitle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/job-grades/titles/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-titles'] })
      qc.invalidateQueries({ queryKey: ['departments'] })
    },
  })
}
