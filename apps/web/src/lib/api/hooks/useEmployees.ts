import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import type {
  EmployeeListItem,
  EmployeeProfile,
  ContactBookEntry,
  PaginationMeta,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  BankInfo,
} from '@hr-system/types'

export interface EmployeeListParams {
  page?: number
  limit?: number
  search?: string
  departmentId?: string
  officeId?: string
  employmentStatus?: string
  bloodGroup?: string
}

export function useEmployees(params: EmployeeListParams = {}) {
  return useQuery({
    queryKey: ['employees', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/employees', { params })
      return data as { data: EmployeeListItem[]; meta: PaginationMeta }
    },
  })
}

export interface ContactBookParams {
  page?: number
  limit?: number
  search?: string
  departmentId?: string
  bloodGroup?: string
}

export function useContactBook(params: ContactBookParams = {}) {
  return useQuery({
    queryKey: ['contact-book', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/employees/directory', { params })
      return data as { data: ContactBookEntry[]; meta: PaginationMeta }
    },
  })
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/employees/${id}`)
      return data.data as EmployeeProfile
    },
    enabled: !!id,
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateEmployeeRequest) => {
      const { data } = await apiClient.post('/employees', payload)
      return data.data as { employee: EmployeeProfile; tempPassword: string }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateEmployeeRequest) => {
      const { data } = await apiClient.patch(`/employees/${id}`, payload)
      return data.data as EmployeeProfile
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee', id] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

// Table-level mutation — takes id in payload so one instance handles all rows
export function useUpdateEmployeeById() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & UpdateEmployeeRequest) => {
      const { data } = await apiClient.patch(`/employees/${id}`, payload)
      return data.data as EmployeeProfile
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['employee', vars.id] })
      qc.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useDeactivateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/employees/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })
}

export function useGeneratePasswordReset() {
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { data } = await apiClient.post(`/employees/${employeeId}/reset-password`)
      return data.data as { token: string; resetLink: string; expiresAt: string }
    },
  })
}

export function useBankInfo(employeeId: string) {
  return useQuery({
    queryKey: ['bank-info', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/employees/${employeeId}/bank-info`)
      return data.data as BankInfo | null
    },
    enabled: !!employeeId,
  })
}
