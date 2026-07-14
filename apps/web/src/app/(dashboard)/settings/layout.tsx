'use client'

import { usePathname } from 'next/navigation'
import { Tabs } from '@/components/ui/tabs'
import { useAuthStore } from '@/store/auth.store'
import { UserRole } from '@hr-system/types'

const TABS = [
  { href: '/settings/profile',  label: 'Profile'  },
  { href: '/settings/security', label: 'Security' },
  { href: '/settings/roles',    label: 'Roles & Permissions', superAdminOnly: true },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const user = useAuthStore(s => s.user)

  const items = TABS.map(t => ({
    key: t.href,
    label: t.label,
    href: t.href,
    hidden: t.superAdminOnly && user?.role !== UserRole.SUPER_ADMIN,
  }))

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Settings</h1>
      <Tabs items={items} active={pathname} />
      {children}
    </div>
  )
}
