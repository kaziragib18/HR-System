import { useMutation } from '@tanstack/react-query'
import { apiClient } from '../client'

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
