'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface TabItem {
  key: string
  label: string
  href?: string
  hidden?: boolean
}

/**
 * Renders route tabs (items with `href`, via next/link) and state tabs
 * (items without `href`, via a button + onChange) side by side, so the same
 * component drives both settings/layout.tsx's route-based sub-nav and any
 * in-page section switcher.
 */
export function Tabs({
  items,
  active,
  onChange,
}: {
  items: TabItem[]
  active: string
  onChange?: (key: string) => void
}) {
  const visible = items.filter(t => !t.hidden)

  return (
    <div className="mb-6 flex gap-1 border-b">
      {visible.map(tab => {
        const isActive = active === (tab.href ?? tab.key)
        const cls = cn(
          'border-b-2 px-4 py-2 text-sm',
          isActive
            ? 'border-primary font-medium text-foreground'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        )
        if (tab.href) {
          return (
            <Link key={tab.key} href={tab.href} className={cls}>
              {tab.label}
            </Link>
          )
        }
        return (
          <button key={tab.key} type="button" onClick={() => onChange?.(tab.key)} className={cls}>
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
