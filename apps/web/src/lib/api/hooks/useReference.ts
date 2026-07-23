import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface Office {
  id: string
  code: string
  name: string
  country: string
  currency: string
  timezone: string
  taxRegime: string
  workStartTime: string
  workEndTime: string
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  logoUrl?: string | null
  isActive: boolean
  isDefault: boolean
  showOnClock: boolean
}

/** Active offices only — the list every filter/picker in the app should use. */
export function useOffices() {
  return useQuery({
    queryKey: ['offices'],
    queryFn: async () => {
      const { data } = await apiClient.get('/company/offices')
      return data.data as Office[]
    },
  })
}

/** True once offices have loaded and there's only one active office — every
 * office-scoped filter/picker in the app should hide itself in that case. */
export function useIsSingleOffice(): boolean {
  const { data: offices } = useOffices()
  return (offices?.length ?? 0) <= 1
}

/** SUPER_ADMIN-only: every office including deactivated ones, for the Company
 * tab's management view (so a removed office can be found again to reactivate). */
export function useAllOffices() {
  return useQuery({
    queryKey: ['offices', 'all'],
    queryFn: async () => {
      const { data } = await apiClient.get('/company/offices?includeInactive=true')
      return data.data as Office[]
    },
  })
}

export interface CreateOfficeInput {
  code: string
  name: string
  country: string
  currency: string
  timezone: string
  taxRegime?: string
  workStartTime?: string
  workEndTime?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  showOnClock?: boolean
}

export type UpdateOfficeInput = Partial<Omit<CreateOfficeInput, 'code'>> & { logoUrl?: string }

function invalidateOffices(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['offices'] })
}

export function useCreateOffice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateOfficeInput) => {
      const { data } = await apiClient.post('/company/offices', payload)
      return data.data as Office
    },
    onSuccess: () => invalidateOffices(qc),
  })
}

export function useUpdateOffice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateOfficeInput & { id: string }) => {
      const { data } = await apiClient.patch(`/company/offices/${id}`, payload)
      return data.data as Office
    },
    onSuccess: () => invalidateOffices(qc),
  })
}

export function useDeactivateOffice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/company/offices/${id}/deactivate`)
      return data.data as Office
    },
    onSuccess: () => invalidateOffices(qc),
  })
}

export function useReactivateOffice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/company/offices/${id}/reactivate`)
      return data.data as Office
    },
    onSuccess: () => invalidateOffices(qc),
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
