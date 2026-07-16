'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useUiStore } from '@/store/ui.store'
import { useNotificationStore } from '@/store/notification.store'
import { logout } from '@/lib/api/auth'
import { UserRole } from '@hr-system/types'
import { Avatar } from '@/components/ui/primitives'
import {
  LayoutDashboard,
  Users,
  Building2,
  Clock,
  CalendarDays,
  ClipboardList,
  BookUser,
  Bell,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Inbox,
  Banknote,
  Wallet,
  DollarSign,
  type LucideIcon,
} from 'lucide-react'

const SA = [UserRole.SUPER_ADMIN]

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  roles: UserRole[] | null
  exclude: UserRole[] | null
}

interface NavGroup {
  label: string
  items: NavItem[]
}

// Grouped for scannability — a 14-item flat list is hard to parse. Each item
// keeps its original role/exclude gating; empty groups are dropped per user.
const NAV_GROUPS: NavGroup[] = [
  {
    label: '',
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: null, exclude: null }],
  },
  {
    label: 'People',
    items: [
      { href: '/employees', label: 'Employees', icon: Users, roles: [UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.DEPT_HEAD], exclude: null },
      { href: '/departments', label: 'Departments', icon: Building2, roles: [UserRole.HR_MANAGER, UserRole.SUPER_ADMIN], exclude: null },
      { href: '/contact-book', label: 'Contact Book', icon: BookUser, roles: null, exclude: null },
    ],
  },
  {
    label: 'Time & Leave',
    items: [
      { href: '/attendance', label: 'Attendance', icon: Clock, roles: null, exclude: SA },
      { href: '/leave', label: 'My Leave', icon: CalendarDays, roles: null, exclude: SA },
      { href: '/timemanagement', label: 'Time Management', icon: ClipboardList, roles: null, exclude: null },
      { href: '/approvals', label: 'Approvals', icon: Inbox, roles: [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.DEPT_HEAD, UserRole.DEPT_MANAGER], exclude: null },
    ],
  },
  {
    label: 'Payroll',
    items: [
      { href: '/payroll', label: 'Payroll', icon: Banknote, roles: [UserRole.SUPER_ADMIN], exclude: null },
      { href: '/payroll/my-payslips', label: 'My Payslips', icon: Wallet, roles: null, exclude: SA },
      { href: '/salary', label: 'Salary', icon: DollarSign, roles: [UserRole.SUPER_ADMIN], exclude: null },
    ],
  },
  {
    label: 'Company',
    items: [
      { href: '/announcements', label: 'Announcements', icon: Megaphone, roles: null, exclude: null },
      { href: '/notifications', label: 'Notifications', icon: Bell, roles: null, exclude: null },
      { href: '/settings', label: 'Settings', icon: Settings, roles: null, exclude: null },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar } = useUiStore()
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  function itemVisible(item: NavItem): boolean {
    const roleOk = !item.roles || (user && item.roles.includes(user.role as UserRole))
    const notExcluded = !item.exclude || !(user && item.exclude.includes(user.role as UserRole))
    return !!roleOk && notExcluded
  }

  // Filter items per role, then drop any group left with no visible items.
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(itemVisible) })).filter(
    (g) => g.items.length > 0
  )

  const collapsed = sidebarCollapsed

  function isActive(href: string): boolean {
    return pathname === href || (href !== '/' && pathname.startsWith(href))
  }

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(item.href)
    const badge = item.href === '/notifications' && unreadCount > 0 ? unreadCount : 0
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          active
            ? 'bg-primary/10 font-medium text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          collapsed && 'justify-center px-2'
        )}
      >
        {/* active accent bar */}
        {active && !collapsed && (
          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        <span className="relative shrink-0">
          <item.icon className="h-[18px] w-[18px]" />
          {/* collapsed: show a dot instead of a numeric badge */}
          {badge > 0 && collapsed && (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
          )}
        </span>
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && badge > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Brand + collapse toggle */}
      <div className="flex h-14 items-center gap-2 border-b px-3">
        {!collapsed && (
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              HR
            </span>
            <span className="truncate text-sm font-semibold">HR System</span>
          </Link>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav (scrolls if it overflows) */}
      <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-2">
        {groups.map((group, gi) => (
          <div key={group.label || `grp-${gi}`} className="space-y-1">
            {group.label &&
              (collapsed ? (
                gi > 0 && <div className="mx-2 mb-1 border-t" />
              ) : (
                <p className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {group.label}
                </p>
              ))}
            {collapsed && !group.label && gi > 0 && <div className="mx-2 mb-1 border-t" />}
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      {user && (
        <div className="border-t p-2">
          {collapsed ? (
            <div className="mb-1 flex justify-center">
              <Link
                href="/settings"
                title={`${user.firstName} ${user.lastName}${user.departmentName ? ` · ${user.departmentName}` : ''}`}
              >
                <Avatar firstName={user.firstName} lastName={user.lastName} url={user.avatarUrl} size={30} />
              </Link>
            </div>
          ) : (
            <Link
              href="/settings"
              className="mb-1 flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted"
              title="Profile & settings"
            >
              <Avatar firstName={user.firstName} lastName={user.lastName} url={user.avatarUrl} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{user.role.replace(/_/g, ' ')}</p>
                {user.departmentName && (
                  <p
                    className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground"
                    title={user.departmentName}
                  >
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{user.departmentName}</span>
                  </p>
                )}
              </div>
            </Link>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
              collapsed && 'justify-center px-2'
            )}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      )}
    </aside>
  )
}
