import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface Department {
  id: string
  name: string
  code: string
  description?: string | null
  officeId: string
  office: { id: string; code: string; name: string }
  manager?: { id: string; firstName: string; lastName: string } | null
  jobTitles: { id: string; name: string }[]
  _count: { employees: number }
}

export interface DepartmentMember {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string | null
  jobTitle?: { name: string } | null
  jobGrade?: { name: string } | null
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await apiClient.get('/departments')
      return data.data as Department[]
    },
  })
}

export function useDepartmentMembers(id: string) {
  return useQuery({
    queryKey: ['department-members', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/departments/${id}/employees`)
      return data.data as DepartmentMember[]
    },
    enabled: !!id,
  })
}

export interface CreateDepartmentPayload {
  name: string
  code: string
  description?: string
  officeId: string
  parentId?: string
}

export function useCreateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateDepartmentPayload) => {
      const { data } = await apiClient.post('/departments', payload)
      return data.data as Department
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  })
}

export function useUpdateDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<CreateDepartmentPayload>) => {
      const { data } = await apiClient.patch(`/departments/${id}`, payload)
      return data.data as Department
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  })
}

export function useDeleteDepartment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/departments/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  })
}

export function useAssignDeptManager() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, managerId }: { id: string; managerId: string }) => {
      const { data } = await apiClient.patch(`/departments/${id}/manager`, { managerId })
      return data.data as Department
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  })
}

export function useRemoveDeptManager() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/departments/${id}/manager`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  })
}

export interface EmployeeSearchResult {
  id: string
  firstName: string
  lastName: string
  employeeId: string
  jobTitle?: { name: string } | null
  department?: { name: string } | null
  avatarUrl?: string | null
}

export function useEmployeeSearch(query: string) {
  return useQuery({
    queryKey: ['employee-search', query],
    queryFn: async () => {
      const { data } = await apiClient.get('/employees', { params: { search: query, limit: 8 } })
      return data.data as EmployeeSearchResult[]
    },
    enabled: query.trim().length >= 1,
    staleTime: 10_000,
  })
}
