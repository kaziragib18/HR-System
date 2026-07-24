import axios from 'axios'
import { apiClient } from './client'
import { getCsrfToken } from './csrf'
import { useAuthStore } from '@/store/auth.store'
import { queryClient } from '@/lib/queryClient'
import type { AuthUser } from '@hr-system/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/**
 * Restores the session on app load. The access token lives only in memory,
 * so on a fresh page load we use the httpOnly refresh cookie to get a new
 * access token, then fetch the current user.
 *
 * Uses raw axios (not apiClient) to bypass the 401-refresh interceptor.
 */
export async function bootstrapSession(): Promise<void> {
  const store = useAuthStore.getState()
  try {
    const { data: refreshData } = await axios.post(
      `${API_URL}/api/v1/auth/refresh`,
      {},
      { withCredentials: true, headers: { 'X-CSRF-Token': getCsrfToken() } }
    )
    const token = refreshData.data.accessToken as string

    const { data: meData } = await axios.get(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      withCredentials: true,
    })

    store.setAuth(meData.data as AuthUser, token)
  } catch {
    store.clearAuth()
  }
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout')
  } catch {
    // ignore — clear local state regardless
  }
  useAuthStore.getState().clearAuth()
  // Self-scoped query keys (e.g. ['my-dashboard'], ['leave','applications','me'])
  // don't include the user's id, so without this the next person to log in on
  // this tab would see the previous account's cached "my X" data until each
  // query's own staleTime happened to expire — this navigation is a client-side
  // router.replace(), not a hard reload, so the QueryClient instance survives it.
  queryClient.clear()
}
