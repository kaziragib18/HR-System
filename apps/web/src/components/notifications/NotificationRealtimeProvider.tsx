'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { useNotificationStore } from '@/store/notification.store'
import type { Notification } from '@hr-system/types'

/**
 * Subscribes to Supabase Realtime INSERTs on the Notification table for the
 * current employee. Requires Realtime to be enabled on that table in the
 * Supabase dashboard — if it isn't, useUnreadCount's polling still keeps the
 * bell badge correct within its refetch interval.
 */
export function NotificationRealtimeProvider() {
  const employeeId = useAuthStore((s) => s.user?.employeeId)
  const addNotification = useNotificationStore((s) => s.addNotification)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!employeeId) return

    const channel = supabase
      .channel(`notifications:${employeeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Notification', filter: `employeeId=eq.${employeeId}` },
        (payload) => {
          addNotification(payload.new as Notification)
          // addNotification only updates the Zustand store (bell badge) — the
          // /notifications page itself renders from this React Query cache,
          // which otherwise wouldn't pick up the new row until an unrelated
          // refetch (e.g. remounting the page).
          void queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [employeeId, addNotification, queryClient])

  return null
}
