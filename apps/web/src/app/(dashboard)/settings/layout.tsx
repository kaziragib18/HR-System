'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { UserRole } from '@hr-system/types'

const TABS = [
  { href: '/settings/profile',  label: 'Profile'      },
  { href: '/settings/security', label: 'Security'     },
  { href: '/settings/holidays', label: 'Holidays',  hrOnly: true },
  { href: '/settings/company',  label: 'Company',   superAdminOnly: true },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const isHr = user && [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER].includes(user.role as UserRole)
  const isSa = user?.role === UserRole.SUPER_ADMIN
  const tabs = TABS.filter((t) => {
    if (t.superAdminOnly && !isSa) return false
    if (t.hrOnly && !isHr) return false
    return true
  })

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Settings</h1>
      <div className="mb-6 flex gap-1 border-b">
        {tabs.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'border-b-2 px-4 py-2 text-sm',
                active
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
      {children}
    </div>
  )
}
