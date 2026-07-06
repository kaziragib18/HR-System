'use client'

import { Bell } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useNotificationStore } from '@/store/notification.store'
import { useUnreadCount } from '@/lib/api/hooks/useNotifications'
import { useAuthStore } from '@/store/auth.store'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from '@/components/ui/primitives'

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/employees': 'Employees',
  '/departments': 'Departments',
  '/attendance': 'Attendance',
  '/leave': 'My Leave',
  '/payroll': 'Payroll',
  '/payroll/my-payslips': 'My Payslips',
  '/salary': 'Salary Management',
  '/documents': 'Documents',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
}

function getRouteLabel(pathname: string): string {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname]
  // Match prefix (e.g. /employees/123 → Employees)
  for (const [route, label] of Object.entries(ROUTE_LABELS)) {
    if (route !== '/' && pathname.startsWith(route)) return label
  }
  return ''
}

export function Topbar() {
  const { unreadCount } = useNotificationStore()
  useUnreadCount()
  const { user } = useAuthStore()
  const pathname = usePathname()
  const routeLabel = getRouteLabel(pathname)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card/60 px-6 backdrop-blur">
      <span className="text-sm font-medium text-foreground">{routeLabel}</span>
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
