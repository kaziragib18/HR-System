import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface SessionInfo {
  id: string
  deviceInfo: string | null
  ipAddress: string | null
  createdAt: string
  lastUsedAt: string
  isCurrent: boolean
}

export function useSessions() {
  return useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async () => {
      const { data } = await apiClient.get('/auth/sessions')
      return data.data as SessionInfo[]
    },
  })
}

export function useRevokeSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/auth/sessions/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  })
}

export function useRevokeSessions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiClient.delete(`/auth/sessions/${id}`)))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      const { data } = await apiClient.patch('/auth/change-password', payload)
      return data
    },
  })
}

export function useSetupTwoFactor() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/auth/2fa/setup')
      return data.data as { secret: string; qrCode: string }
    },
  })
}

export function useEnableTwoFactor() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data } = await apiClient.post('/auth/2fa/enable', { code })
      return data
    },
  })
}

export function useDisableTwoFactor() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/auth/2fa/disable')
      return data
    },
  })
}
