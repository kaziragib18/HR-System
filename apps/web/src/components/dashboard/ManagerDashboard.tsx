'use client'

import { useState, useEffect } from 'react'
import { useDashboardStats, useHeadcountByDepartment } from '@/lib/api/hooks/useDashboard'
import { useOffices } from '@/lib/api/hooks/useReference'
import { Card, Avatar, Skeleton } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import { ComplianceDocsCard } from '@/components/dashboard/ComplianceDocsCard'
import { AnnouncementsCard } from '@/components/dashboard/AnnouncementsCard'
import { RecentApprovalsCard } from '@/components/dashboard/RecentApprovalsCard'
import { OfficeClock } from '@/components/dashboard/OfficeClock'
import { cn } from '@/lib/utils'
import { UserRole } from '@hr-system/types'
import Link from 'next/link'
import { Users, CalendarOff, Clock, Inbox, ChevronRight, type LucideIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function ManagerDashboard() {
  const { user } = useAuthStore()
  const { data: stats, isLoading } = useDashboardStats()
  const { data: byDept } = useHeadcountByDepartment()
  const { data: offices } = useOffices()
  const now = new Date()

  // Only SUPER_ADMIN's headcount data ever spans more than one office (HR_MANAGER
  // is always office-scoped server-side), and only then does a filter do anything.
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN
  const showOfficeFilter = isSuperAdmin && (offices?.length ?? 0) > 1

  // Always scoped to exactly one office at a time (BD or UK) — no merged "All"
  // view, so two departments sharing a name across offices (e.g. both BD and
  // UK have an "Accounts") never render as ambiguous identically-labeled bars.
  const [officeFilter, setOfficeFilter] = useState('')
  useEffect(() => {
    if (officeFilter || !offices || offices.length === 0) return
    const ownCode =
      user?.officeCode && offices.some((o) => o.code === user.officeCode)
        ? user.officeCode
        : offices[0].code
    setOfficeFilter(ownCode)
  }, [offices, officeFilter, user?.officeCode])

  const chartData =
    showOfficeFilter && officeFilter
      ? (byDept ?? []).filter((d) => d.officeCode === officeFilter)
      : (byDept ?? [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Card className="flex flex-1 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              firstName={user?.firstName ?? '?'}
              lastName={user?.lastName ?? '?'}
              url={user?.avatarUrl}
              size={48}
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold">Welcome back, {user?.firstName}</h1>
              <p className="truncate text-sm text-muted-foreground">
                {user?.role.replace(/_/g, ' ')} · {user?.officeCode} office overview
              </p>
            </div>
          </div>
          {/* <span className="shrink-0 text-sm text-muted-foreground">
            {MONTHS[now.getMonth()]} {now.getFullYear()}
          </span> */}
        </Card>
        <OfficeClock />
      </div>

      {isLoading ? (
        <ManagerDashboardSkeleton />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="grid grid-cols-2 gap-4">
              <Stat
                icon={Users}
                label="Headcount"
                value={stats?.headcount ?? 0}
                tone="blue"
                href="/employees"
              />
              <Stat
                icon={CalendarOff}
                label="On leave today"
                value={stats?.onLeaveToday ?? 0}
                tone="violet"
              />
              <Stat icon={Clock} label="Late today" value={stats?.lateToday ?? 0} tone="rose" />
              <Stat
                icon={Inbox}
                label="Pending leave"
                value={stats?.pendingLeaves ?? 0}
                tone="emerald"
                href="/approvals?tab=leave"
              />
            </div>
            <RecentApprovalsCard />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <AnnouncementsCard />
            <ComplianceDocsCard />
          </div>

          {byDept && byDept.length > 0 && (
            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Headcount by department
                </p>
                {showOfficeFilter && (
                  <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
                    {offices!.map((o) => (
                      <button
                        key={o.code}
                        onClick={() => setOfficeFilter(o.code)}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                          officeFilter === o.code
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                      >
                        {o.code}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="department"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    allowDecimals={false}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'hsl(var(--popover-foreground))',
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={56}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function ManagerDashboardSkeleton() {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="flex items-center gap-4">
              <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </Card>
          ))}
        </div>
        <Card className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton className="h-64 w-full" />
      </Card>
    </>
  )
}

const TONES: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
  href,
}: {
  icon: LucideIcon
  label: string
  value: number
  tone: string
  href?: string
}) {
  const inner = (
    <>
      <div
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
          TONES[tone]
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
      {href && <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50" />}
    </>
  )
  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-4 rounded-lg border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
      >
        {inner}
      </Link>
    )
  }
  return <Card className="flex items-center gap-4">{inner}</Card>
}
