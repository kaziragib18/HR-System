'use client'

import { useEffect } from 'react'
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

  useEffect(() => {
    if (!employeeId) return

    const channel = supabase
      .channel(`notifications:${employeeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Notification', filter: `employeeId=eq.${employeeId}` },
        (payload) => addNotification(payload.new as Notification)
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [employeeId, addNotification])

  return null
}
