'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, User, KeyRound, LogOut } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useNotificationStore } from '@/store/notification.store'
import { useUnreadCount } from '@/lib/api/hooks/useNotifications'
import { useAuthStore } from '@/store/auth.store'
import { logout } from '@/lib/api/auth'
import { ThemeToggle } from './ThemeToggle'
import { Avatar, RolePill } from '@/components/ui/primitives'

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
  const router = useRouter()
  const routeLabel = getRouteLabel(pathname)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  // Close on outside click or Escape — a compact anchored dropdown, not a
  // modal, so there's no backdrop to click; it just closes on anything else.
  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

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
          <div ref={menuRef} className="relative ml-2">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-80"
              aria-label="Account menu"
            >
              <Avatar
                firstName={user.firstName}
                lastName={user.lastName}
                url={user.avatarUrl}
                size={32}
              />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-4 w-52 rounded-xl border bg-card p-2 shadow-xl">
                <div className="flex flex-col items-center gap-1.5 border-b pb-2 text-center">
                  <Avatar
                    firstName={user.firstName}
                    lastName={user.lastName}
                    url={user.avatarUrl}
                    size={36}
                  />
                  <div>
                    <p className="text-xs font-medium">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{user.email}</p>
                  </div>
                  <RolePill role={user.role} />
                </div>

                <nav className="mt-1.5 space-y-0.5">
                  <Link
                    href="/settings/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    My Profile
                  </Link>
                  <Link
                    href="/settings/security"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                    Change Password
                  </Link>
                </nav>

                <div className="mt-1 border-t pt-1">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
