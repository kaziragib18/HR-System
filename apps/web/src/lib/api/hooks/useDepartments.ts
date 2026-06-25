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
