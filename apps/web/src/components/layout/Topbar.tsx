'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { useNotificationStore } from '@/store/notification.store'
import { useAuthStore } from '@/store/auth.store'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from '@/components/ui/primitives'

export function Topbar() {
  const { unreadCount } = useNotificationStore()
  const { user } = useAuthStore()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card/60 px-6 backdrop-blur">
      <div />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Link
          href="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        {user && (
          <div className="ml-2 flex items-center gap-2 border-l pl-3">
            <Avatar firstName={user.firstName} lastName={user.lastName} url={user.avatarUrl} size={32} />
            <div className="hidden leading-tight md:block">
              <p className="text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{user.role.replace(/_/g, ' ')}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
