'use client'

import { usePathname } from 'next/navigation'
import { Tabs } from '@/components/ui/tabs'

const TABS = [
  { href: '/settings/profile',  label: 'Profile'  },
  { href: '/settings/security', label: 'Security' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const items = TABS.map(t => ({ key: t.href, label: t.label, href: t.href }))

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Settings</h1>
      <Tabs items={items} active={pathname} />
      {children}
    </div>
  )
}
