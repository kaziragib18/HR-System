'use client'

import { useMemo, useState } from 'react'
import { CheckCheck, Inbox, Loader2, X } from 'lucide-react'
import { PageHeader, Card, Skeleton } from '@/components/ui/primitives'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '@/lib/api/hooks/useNotifications'
import { useNotificationStore } from '@/store/notification.store'
import { cn } from '@/lib/utils'
import type { Notification } from '@hr-system/types'

const PAGE_SIZE = 20

type Category = 'LEAVE' | 'ATTENDANCE' | 'PAYROLL' | 'DOCUMENT' | 'ANNOUNCEMENT' | 'OTHER'

const CATEGORY_LABEL: Record<Category, string> = {
  LEAVE: 'Leave',
  ATTENDANCE: 'Attendance',
  PAYROLL: 'Payroll',
  DOCUMENT: 'Documents',
  ANNOUNCEMENT: 'Announcements',
  OTHER: 'Other',
}

function categoryFor(type: string): Category {
  if (type.startsWith('LEAVE_')) return 'LEAVE'
  if (type === 'PAYSLIP_READY') return 'PAYROLL'
  if (type.startsWith('ATTENDANCE_')) return 'ATTENDANCE'
  if (type === 'DOCUMENT_UPLOADED') return 'DOCUMENT'
  if (type === 'ANNOUNCEMENT') return 'ANNOUNCEMENT'
  return 'OTHER'
}

/** "Today" / "Yesterday" / weekday name (this week) / "12 Jul 2026" (older). */
function dateGroupLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Items arrive newest-first, so same-label runs are always contiguous. */
function groupByDate(items: Notification[]): { label: string; items: Notification[] }[] {
  const groups: { label: string; items: Notification[] }[] = []
  for (const item of items) {
    const label = dateGroupLabel(item.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(item)
    else groups.push({ label, items: [item] })
  }
  return groups
}

export default function NotificationsPage() {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const { data, isLoading, isFetching } = useNotifications(1, limit)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD'>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<Category | 'ALL'>('ALL')

  const items = data?.items ?? []
  const total = data?.meta.total ?? 0
  const hasMore = items.length < total
  const loadingMore = isFetching && items.length > 0

  const presentCategories = useMemo(() => {
    const set = new Set<Category>()
    items.forEach((n) => set.add(categoryFor(n.type)))
    return [...set]
  }, [items])

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (statusFilter === 'UNREAD' && n.isRead) return false
      if (categoryFilter !== 'ALL' && categoryFor(n.type) !== categoryFilter) return false
      return true
    })
  }, [items, statusFilter, categoryFilter])

  const groups = useMemo(() => groupByDate(filtered), [filtered])

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Notifications" description="Everything that's been sent to you, newest first" />
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

      {!isLoading && items.length > 0 && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 py-3">
          <div className="inline-flex shrink-0 items-center rounded-lg border p-0.5">
            {(['ALL', 'UNREAD'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  statusFilter === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {s === 'ALL' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
              </button>
            ))}
          </div>

          {presentCategories.length > 1 && (
            <>
              <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    categoryFilter === 'ALL'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  )}
                >
                  All types
                </button>
                {presentCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      categoryFilter === c
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
            </>
          )}

          {(statusFilter !== 'ALL' || categoryFilter !== 'ALL') && (
            <button
              onClick={() => { setStatusFilter('ALL'); setCategoryFilter('ALL') }}
              className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border px-4 py-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {statusFilter === 'UNREAD'
              ? 'No unread notifications.'
              : categoryFilter !== 'ALL'
                ? `No ${CATEGORY_LABEL[categoryFilter].toLowerCase()} notifications.`
                : 'No notifications match these filters.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.items.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onClick={() => { if (!n.isRead) markAsRead.mutate(n.id) }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-5 flex justify-center">
          <button
            onClick={() => setLimit((l) => l + PAGE_SIZE)}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loadingMore ? 'Loading…' : `Load more (${items.length} of ${total})`}
          </button>
        </div>
      )}
    </div>
  )
}
