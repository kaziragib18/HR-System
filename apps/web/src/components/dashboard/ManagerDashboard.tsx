'use client'

import { useDashboardStats, useHeadcountByDepartment } from '@/lib/api/hooks/useDashboard'
import { Card, Spinner } from '@/components/ui/primitives'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import {
  Users,
  UserCheck,
  CalendarOff,
  Clock,
  Inbox,
  FileClock,
  type LucideIcon,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function ManagerDashboard() {
  const { user } = useAuthStore()
  const { data: stats, isLoading } = useDashboardStats()
  const { data: byDept } = useHeadcountByDepartment()
  const now = new Date()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Welcome back, {user?.firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {user?.role.replace(/_/g, ' ')} · {user?.officeCode} office overview
          </p>
        </div>
        <span className="text-sm text-muted-foreground">
          {MONTHS[now.getMonth()]} {now.getFullYear()}
        </span>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Stat icon={Users} label="Headcount" value={stats?.headcount ?? 0} tone="blue" />
            <Stat icon={UserCheck} label="On probation" value={stats?.onProbation ?? 0} tone="amber" />
            <Stat icon={CalendarOff} label="On leave today" value={stats?.onLeaveToday ?? 0} tone="violet" />
            <Stat icon={Clock} label="Late today" value={stats?.lateToday ?? 0} tone="rose" />
            <Stat icon={Inbox} label="Pending leave" value={stats?.pendingLeaves ?? 0} tone="emerald" />
            <Stat icon={FileClock} label="Open timesheets" value={stats?.openTimesheets ?? 0} tone="slate" />
          </div>

          {byDept && byDept.length > 0 && (
            <Card>
              <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Headcount by department
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byDept}>
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
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
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
}: {
  icon: LucideIcon
  label: string
  value: number
  tone: string
}) {
  return (
    <Card className="flex items-center gap-4">
      <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', TONES[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  )
}
