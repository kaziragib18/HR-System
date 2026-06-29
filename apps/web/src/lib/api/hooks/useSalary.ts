import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface SalaryComponent {
  name: string
  type: 'ALLOWANCE' | 'DEDUCTION'
  amount: number
  isPercentage: boolean
}

export interface SalaryStructure {
  id: string
  employeeId: string | null
  jobGradeId: string | null
  basicSalary: number
  currency: string
  components: SalaryComponent[]
  effectiveFrom: string
  effectiveTo: string | null
  createdAt: string
  employee?: { id: string; firstName: string; lastName: string; employeeId: string } | null
  jobGrade?: { id: string; name: string } | null
}

export interface CreateSalaryPayload {
  employeeId?: string
  jobGradeId?: string
  basicSalary: number
  currency: string
  components: SalaryComponent[]
  effectiveFrom: string
  effectiveTo?: string
}

export function useEmployeeSalary(employeeId: string | null) {
  return useQuery({
    queryKey: ['salary', 'current', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/salary/${employeeId}`)
      return data.data as SalaryStructure
    },
    enabled: !!employeeId,
    retry: (count, err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      return status !== 404 && count < 2
    },
  })
}

export function useSalaryHistory(employeeId: string | null) {
  return useQuery({
    queryKey: ['salary', 'history', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get('/salary', { params: { employeeId, limit: 20 } })
      return data.data as SalaryStructure[]
    },
    enabled: !!employeeId,
  })
}

export function useCreateSalaryStructure() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateSalaryPayload) => {
      const { data } = await apiClient.post('/salary', payload)
      return data.data as SalaryStructure
    },
    onSuccess: (_, vars) => {
      if (vars.employeeId) {
        qc.invalidateQueries({ queryKey: ['salary', 'current', vars.employeeId] })
        qc.invalidateQueries({ queryKey: ['salary', 'history', vars.employeeId] })
      }
    },
  })
}
