'use client'

import { Bell } from 'lucide-react'
import { useNotificationStore } from '@/store/notification.store'
import { useAuthStore } from '@/store/auth.store'
import Link from 'next/link'

export function Topbar() {
  const { unreadCount } = useNotificationStore()
  const { user } = useAuthStore()

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div />
      <div className="flex items-center gap-4">
        <Link
          href="/notifications"
          className="relative rounded-md p-2 hover:bg-muted"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        {user && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <span className="hidden text-sm md:block">
              {user.firstName} {user.lastName}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
