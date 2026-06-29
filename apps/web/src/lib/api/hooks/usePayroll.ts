'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface PayrollRun {
  id: string
  officeId: string
  month: number
  year: number
  status: string
  totalGross: string
  totalNet: string
  totalTax: string
  currency: string
  employeeCount: number
  processedAt: string | null
  approvedAt: string | null
  office: { id: string; name: string; code: string; currency: string }
}

export interface TaxSlab {
  from: number
  to?: number
  rate: number
  taxAmount: number
  label: string
}

export interface TaxBreakdown {
  regime: string
  taxableIncome: number
  totalTax: number
  slabs: TaxSlab[]
}

export interface PayrollEntry {
  id: string
  payrollRunId: string
  employeeId: string
  grossSalary: string
  basicSalary: string
  allowances: string
  overtimePay: string
  deductions: string
  taxAmount: string
  pfContribution: string
  netSalary: string
  currency: string
  workingDays: number
  presentDays: number
  leaveDays: number
  overtimeMinutes: number
  taxBreakdown: TaxBreakdown
  employee?: { id: string; firstName: string; lastName: string; employeeId: string; avatarUrl?: string | null }
  payrollRun?: { id: string; month: number; year: number; status: string; currency: string }
}

export interface PayrollRunDetail extends PayrollRun {
  entries: PayrollEntry[]
}

// ── Runs (HR) ────────────────────────────────────────────────────────────────

export function usePayrollRuns() {
  return useQuery({
    queryKey: ['payroll', 'runs'],
    queryFn: async () => {
      const { data } = await apiClient.get('/payroll/runs')
      return (data.data ?? []) as PayrollRun[]
    },
    staleTime: 30_000,
  })
}

export function usePayrollRun(id: string) {
  return useQuery({
    queryKey: ['payroll', 'runs', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/payroll/runs/${id}`)
      return data.data as PayrollRunDetail
    },
    enabled: !!id,
    staleTime: 15_000,
  })
}

export function useCreatePayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { month: number; year: number }) => {
      const { data } = await apiClient.post('/payroll/runs', input)
      return data.data as PayrollRun
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll', 'runs'] }),
  })
}

export function useProcessPayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/payroll/runs/${id}/process`)
      return data.data as PayrollRun
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['payroll', 'runs'] })
      qc.invalidateQueries({ queryKey: ['payroll', 'runs', id] })
    },
  })
}

export function useApprovePayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/payroll/runs/${id}/approve`)
      return data.data as PayrollRun
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['payroll', 'runs'] })
      qc.invalidateQueries({ queryKey: ['payroll', 'runs', id] })
    },
  })
}

export function useMarkPaidPayrollRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/payroll/runs/${id}/mark-paid`)
      return data.data as PayrollRun
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['payroll', 'runs'] })
      qc.invalidateQueries({ queryKey: ['payroll', 'runs', id] })
    },
  })
}

// ── Self-service ─────────────────────────────────────────────────────────────

export function useMyPayslips() {
  return useQuery({
    queryKey: ['payroll', 'me'],
    queryFn: async () => {
      const { data } = await apiClient.get('/payroll/me')
      return (data.data ?? []) as PayrollEntry[]
    },
    staleTime: 60_000,
  })
}
