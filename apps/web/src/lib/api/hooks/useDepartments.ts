import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface DeptRoleHolder {
  id: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  user?: { role: string } | null
}

export interface Department {
  id: string
  name: string
  code: string
  description?: string | null
  officeId: string
  office: { id: string; code: string; name: string }
  manager?: { id: string; firstName: string; lastName: string } | null
  /** Employees in this department holding DEPT_HEAD / DEPT_MANAGER roles. */
  employees?: DeptRoleHolder[]
  jobTitles: { id: string; name: string }[]
  _count: { employees: number }
}

/** A department's display label for flat, cross-office lists (filter dropdowns,
 * reassignment selects) — appends the office code (e.g. "Accounts (UK)") only
 * when `allDepartments` actually spans more than one office, since BD and UK
 * can now have identically-named departments (Department.code is unique per
 * office, not globally). Matches this app's "hide office context when there's
 * only one office" convention elsewhere. Pass the same list you're mapping
 * over as `allDepartments` so the office-count check reflects what's on screen. */
export function departmentLabel(dept: Pick<Department, 'name' | 'office'>, allDepartments: Pick<Department, 'office'>[]): string {
  const multiOffice = new Set(allDepartments.map(d => d.office.code)).size > 1
  return multiOffice ? `${dept.name} (${dept.office.code})` : dept.name
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
  user?: { role: string } | null
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

/** Appoint a department Head or Manager (also switches the person's role). */
export function useAppointDeptRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, employeeId, role }: { id: string; employeeId: string; role: 'DEPT_HEAD' | 'DEPT_MANAGER' }) => {
      const { data } = await apiClient.patch(`/departments/${id}/appoint`, { employeeId, role })
      return data.data as Department
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['departments'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['department-members', vars.id] })
    },
  })
}

/** Remove a Head/Manager appointment (resets the person's role to EMPLOYEE). */
export function useDismissDeptRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, employeeId }: { id: string; employeeId: string }) => {
      const { data } = await apiClient.patch(`/departments/${id}/dismiss`, { employeeId })
      return data.data as Department
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['departments'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['department-members', vars.id] })
    },
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
