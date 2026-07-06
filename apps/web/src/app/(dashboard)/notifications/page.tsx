'use client'

import { useState } from 'react'
import { CheckCheck } from 'lucide-react'
import { PageHeader, Spinner, EmptyState } from '@/components/ui/primitives'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/lib/api/hooks/useNotifications'
import { useNotificationStore } from '@/store/notification.store'

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useNotifications(page)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  const items = data?.items ?? []

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeader title="Notifications" />
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
            className="mb-4 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState message="No notifications yet." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onClick={() => { if (!n.isRead) markAsRead.mutate(n.id) }}
            />
          ))}
        </div>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-xs text-muted-foreground">
            Page {data.meta.page} of {data.meta.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
            disabled={page >= data.meta.totalPages}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
