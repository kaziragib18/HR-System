'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import { useNotificationStore } from '@/store/notification.store'
import type { Notification, PaginationMeta } from '@hr-system/types'

export function useNotifications(page = 1, limit = 20) {
  const setNotifications = useNotificationStore((s) => s.setNotifications)
  return useQuery({
    queryKey: ['notifications', page, limit],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications', { params: { page, limit } })
      const items = data.data as Notification[]
      // Feed the Zustand store from the first page so the Topbar badge / any
      // other consumer stays in sync with what's actually been fetched.
      if (page === 1) setNotifications(items)
      return { items, meta: data.meta as PaginationMeta }
    },
  })
}

export function useUnreadCount() {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount)
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications/unread-count')
      const count = data.data.count as number
      setUnreadCount(count)
      return count
    },
    refetchInterval: 60_000,
  })
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  const markAsRead = useNotificationStore((s) => s.markAsRead)
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`)
      return id
    },
    onSuccess: (id) => {
      markAsRead(id)
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useMarkAllAsRead() {
  const qc = useQueryClient()
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)
  return useMutation({
    mutationFn: async () => {
      await apiClient.patch('/notifications/read-all')
    },
    onSuccess: () => {
      markAllAsRead()
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
