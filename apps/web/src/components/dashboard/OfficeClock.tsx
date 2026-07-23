'use client'

import { useState, useEffect } from 'react'
import { useOffices } from '@/lib/api/hooks/useReference'
import { cn } from '@/lib/utils'

const ACCENTS = [
  'text-amber-500 dark:text-amber-400',
  'text-sky-500 dark:text-sky-400',
  'text-violet-500 dark:text-violet-400',
  'text-emerald-500 dark:text-emerald-400',
]

/** Real-time clock(s) for each active office that has "Dashboard Clock" turned
 * on (Company tab → per-office setting, `Office.showOnClock`) — driven by the
 * actual Company/Office list rather than hardcoded timezones/labels, so it
 * keeps working as offices are added/removed. Shown on every dashboard
 * (employee and admin/manager alike). This is an admin-controlled, shared
 * setting, not a per-user preference — there's deliberately no toggle here. */
export function OfficeClock() {
  const { data: offices } = useOffices()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const shown = (offices ?? []).filter(o => o.showOnClock)
  if (shown.length === 0) return null

  function clockParts(tz: string) {
    const fmtTime = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(now)
    // "1:45:30 PM" → h="1", m="45", s="30", period="PM"
    const match = fmtTime.match(/^(\d+):(\d+):(\d+)\s*(AM|PM)$/)
    const h = match?.[1] ?? '12'
    const m = match?.[2] ?? '00'
    const s = match?.[3] ?? '00'
    const period = match?.[4] ?? 'AM'
    const dayDate = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(now)
    return { h, m, s, period, dayDate }
  }

  return (
    <div className="flex items-center gap-5 rounded-xl border bg-card px-5 py-3 shadow-sm">
      {shown.map((office, i) => {
        const parts = clockParts(office.timezone)
        const accentClass = ACCENTS[i % ACCENTS.length]
        return (
          <div key={office.id} className="flex items-center gap-5">
            {i > 0 && <div className="h-10 w-px bg-border" />}
            <div className="text-center">
              <p className="mb-1 text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
                {office.code} TIME
              </p>
              <div className="flex items-baseline font-mono font-bold text-foreground">
                <span className="text-2xl">{parts.h}</span>
                <span className="mx-0.5 text-lg text-muted-foreground/50">:</span>
                <span className="text-2xl">{parts.m}</span>
                <span className="mx-0.5 text-lg text-muted-foreground/50">:</span>
                <span className={cn('text-base', accentClass)}>{parts.s}</span>
                <span className={cn('ml-1 text-xs font-semibold', accentClass)}>{parts.period}</span>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground/60">{parts.dayDate}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
