import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import type {
  WorkExperience,
  CreateWorkExperienceRequest,
  UpdateWorkExperienceRequest,
  Education,
  CreateEducationRequest,
  UpdateEducationRequest,
  EmployeeSkill,
  CreateEmployeeSkillRequest,
  UpdateEmployeeSkillRequest,
  Certification,
  CreateCertificationRequest,
  UpdateCertificationRequest,
  Identification,
  CreateIdentificationRequest,
  UpdateIdentificationRequest,
} from '@hr-system/types'

function toDateOnlyOrUndefined(value?: string | null) {
  return value ? new Date(value).toISOString() : undefined
}

// ─── Work Experience ────────────────────────────────────────────────────────

export function useWorkExperiences(employeeId: string) {
  return useQuery({
    queryKey: ['work-experience', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/employees/${employeeId}/work-experience`)
      return data.data as WorkExperience[]
    },
    enabled: !!employeeId,
  })
}

export function useCreateWorkExperience(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateWorkExperienceRequest) => {
      const { data } = await apiClient.post(`/employees/${employeeId}/work-experience`, {
        ...payload,
        startDate: toDateOnlyOrUndefined(payload.startDate),
        endDate: toDateOnlyOrUndefined(payload.endDate),
      })
      return data.data as WorkExperience
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-experience', employeeId] }),
  })
}

export function useUpdateWorkExperience(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & UpdateWorkExperienceRequest) => {
      const { data } = await apiClient.patch(`/employees/${employeeId}/work-experience/${id}`, {
        ...payload,
        startDate: toDateOnlyOrUndefined(payload.startDate),
        endDate: toDateOnlyOrUndefined(payload.endDate),
      })
      return data.data as WorkExperience
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-experience', employeeId] }),
  })
}

export function useDeleteWorkExperience(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/employees/${employeeId}/work-experience/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-experience', employeeId] }),
  })
}

// ─── Education ──────────────────────────────────────────────────────────────

export function useEducationHistory(employeeId: string) {
  return useQuery({
    queryKey: ['education', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/employees/${employeeId}/education`)
      return data.data as Education[]
    },
    enabled: !!employeeId,
  })
}

export function useCreateEducation(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateEducationRequest) => {
      const { data } = await apiClient.post(`/employees/${employeeId}/education`, {
        ...payload,
        startDate: toDateOnlyOrUndefined(payload.startDate),
        endDate: toDateOnlyOrUndefined(payload.endDate),
      })
      return data.data as Education
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['education', employeeId] }),
  })
}

export function useUpdateEducation(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & UpdateEducationRequest) => {
      const { data } = await apiClient.patch(`/employees/${employeeId}/education/${id}`, {
        ...payload,
        startDate: toDateOnlyOrUndefined(payload.startDate),
        endDate: toDateOnlyOrUndefined(payload.endDate),
      })
      return data.data as Education
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['education', employeeId] }),
  })
}

export function useDeleteEducation(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/employees/${employeeId}/education/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['education', employeeId] }),
  })
}

// ─── Skills ─────────────────────────────────────────────────────────────────

export function useSkills(employeeId: string) {
  return useQuery({
    queryKey: ['skills', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/employees/${employeeId}/skills`)
      return data.data as EmployeeSkill[]
    },
    enabled: !!employeeId,
  })
}

export function useCreateSkill(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateEmployeeSkillRequest) => {
      const { data } = await apiClient.post(`/employees/${employeeId}/skills`, payload)
      return data.data as EmployeeSkill
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skills', employeeId] }),
  })
}

export function useUpdateSkill(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & UpdateEmployeeSkillRequest) => {
      const { data } = await apiClient.patch(`/employees/${employeeId}/skills/${id}`, payload)
      return data.data as EmployeeSkill
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skills', employeeId] }),
  })
}

export function useDeleteSkill(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/employees/${employeeId}/skills/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['skills', employeeId] }),
  })
}

// ─── Certifications (Training) ───────────────────────────────────────────────

function certificationFormData(payload: CreateCertificationRequest | UpdateCertificationRequest, file?: File) {
  const fd = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') fd.append(key, String(value))
  })
  if (file) fd.append('file', file)
  return fd
}

export function useCertifications(employeeId: string) {
  return useQuery({
    queryKey: ['certifications', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/employees/${employeeId}/certifications`)
      return data.data as Certification[]
    },
    enabled: !!employeeId,
  })
}

export function useCreateCertification(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, ...payload }: CreateCertificationRequest & { file?: File }) => {
      const { data } = await apiClient.post(
        `/employees/${employeeId}/certifications`,
        certificationFormData(payload, file)
      )
      return data.data as Certification
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certifications', employeeId] }),
  })
}

export function useUpdateCertification(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file, ...payload }: { id: string; file?: File } & UpdateCertificationRequest) => {
      const { data } = await apiClient.patch(
        `/employees/${employeeId}/certifications/${id}`,
        certificationFormData(payload, file)
      )
      return data.data as Certification
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certifications', employeeId] }),
  })
}

export function useDeleteCertification(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/employees/${employeeId}/certifications/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['certifications', employeeId] }),
  })
}

// ─── Identification ───────────────────────────────────────────────────────────

function identificationFormData(payload: CreateIdentificationRequest | UpdateIdentificationRequest, file?: File) {
  const fd = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') fd.append(key, String(value))
  })
  if (file) fd.append('file', file)
  return fd
}

export function useIdentifications(employeeId: string) {
  return useQuery({
    queryKey: ['identifications', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/employees/${employeeId}/identifications`)
      return data.data as Identification[]
    },
    enabled: !!employeeId,
  })
}

export function useCreateIdentification(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, ...payload }: CreateIdentificationRequest & { file?: File }) => {
      const { data } = await apiClient.post(
        `/employees/${employeeId}/identifications`,
        identificationFormData(payload, file)
      )
      return data.data as Identification
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identifications', employeeId] }),
  })
}

export function useUpdateIdentification(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, file, ...payload }: { id: string; file?: File } & UpdateIdentificationRequest) => {
      const { data } = await apiClient.patch(
        `/employees/${employeeId}/identifications/${id}`,
        identificationFormData(payload, file)
      )
      return data.data as Identification
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identifications', employeeId] }),
  })
}

export function useDeleteIdentification(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/employees/${employeeId}/identifications/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identifications', employeeId] }),
  })
}

// ─── Documents (download) ─────────────────────────────────────────────────────

export function useDocumentDownloadUrl() {
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data } = await apiClient.get(`/documents/${documentId}/download-url`)
      return data.data as { downloadUrl: string; name: string }
    },
  })
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

export function useUploadAvatar(employeeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('avatar', file)
      const { data } = await apiClient.post(`/employees/${employeeId}/avatar`, fd)
      return data.data as { avatarUrl: string }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employee', employeeId] }),
  })
}
