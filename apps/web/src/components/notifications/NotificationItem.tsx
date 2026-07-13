'use client'

import { CalendarDays, Wallet, Clock, FileText, Megaphone, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification } from '@hr-system/types'

function iconFor(type: string) {
  if (type.startsWith('LEAVE_')) return CalendarDays
  if (type === 'PAYSLIP_READY') return Wallet
  if (type.startsWith('ATTENDANCE_')) return Clock
  if (type === 'DOCUMENT_UPLOADED') return FileText
  if (type === 'ANNOUNCEMENT') return Megaphone
  return Bell
}

function fmtRelative(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationItem({
  notification,
  onClick,
}: {
  notification: Notification
  onClick: () => void
}) {
  const Icon = iconFor(notification.type)

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50',
        !notification.isRead && 'bg-primary/5 border-primary/20'
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          notification.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn('truncate text-sm', !notification.isRead && 'font-semibold')}>
            {notification.title}
          </p>
          {!notification.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{notification.body}</p>
        <p className="mt-1 text-xs text-muted-foreground">{fmtRelative(notification.createdAt)}</p>
      </div>
    </button>
  )
}
