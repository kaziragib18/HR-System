'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useUiStore } from '@/store/ui.store'
import { logout } from '@/lib/api/auth'
import { UserRole } from '@hr-system/types'
import {
  LayoutDashboard,
  Users,
  Building2,
  Clock,
  CalendarDays,
  ClipboardList,
  FileText,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Inbox,
  Banknote,
  Wallet,
  DollarSign,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, roles: null },
  { href: '/employees', label: 'Employees', icon: Users, roles: [UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.DEPT_HEAD] },
  { href: '/departments', label: 'Departments', icon: Building2, roles: [UserRole.HR_MANAGER, UserRole.SUPER_ADMIN] },
  { href: '/attendance', label: 'Attendance', icon: Clock, roles: null },
  { href: '/leave', label: 'My Leave', icon: CalendarDays, roles: null },
  { href: '/leave/approvals', label: 'Approvals', icon: Inbox, roles: [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.DEPT_HEAD, UserRole.TEAM_LEAD] },
  { href: '/timesheets', label: 'Timesheets', icon: ClipboardList, roles: null },
  { href: '/payroll', label: 'Payroll', icon: Banknote, roles: [UserRole.SUPER_ADMIN] },
  { href: '/payroll/my-payslips', label: 'My Payslips', icon: Wallet, roles: null },
  { href: '/salary', label: 'Salary', icon: DollarSign, roles: [UserRole.SUPER_ADMIN] },
  { href: '/documents', label: 'Documents', icon: FileText, roles: null },
  { href: '/notifications', label: 'Notifications', icon: Bell, roles: null },
  { href: '/settings', label: 'Settings', icon: Settings, roles: null },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar } = useUiStore()

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role as UserRole))
  )

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-200',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!sidebarCollapsed && (
          <span className="font-semibold text-sm">HR System</span>
        )}
        <button
          onClick={toggleSidebar}
          className="ml-auto rounded-md p-1 hover:bg-muted"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-2">
        {/* Department label above Dashboard */}
        {!sidebarCollapsed && user?.departmentName && (
          <div className="mb-1 px-3 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {user.departmentName}
            </p>
          </div>
        )}
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                sidebarCollapsed && 'justify-center px-2'
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      {user && (
        <div className="border-t p-2">
          {!sidebarCollapsed && (
            <div className="mb-1 px-3 py-1">
              <p className="text-xs font-medium">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-muted-foreground">{user.role.replace('_', ' ')}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground',
              sidebarCollapsed && 'justify-center px-2'
            )}
            title={sidebarCollapsed ? 'Sign out' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && 'Sign out'}
          </button>
        </div>
      )}
    </aside>
  )
}
