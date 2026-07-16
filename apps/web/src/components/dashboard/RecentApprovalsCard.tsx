'use client'

import Link from 'next/link'
import { Card, Spinner, EmptyState } from '@/components/ui/primitives'
import { usePendingApprovals } from '@/lib/api/hooks/useLeave'
import { usePendingExcuses, usePendingAdjustments } from '@/lib/api/hooks/useAttendance'
import { cn } from '@/lib/utils'
import { CalendarDays, Clock, Undo2, type LucideIcon } from 'lucide-react'

interface RecentItem {
  key: string
  tab: 'leave' | 'excuses' | 'adjustments'
  icon: LucideIcon
  title: string
  meta: string
  when: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function RecentApprovalsCard() {
  const { data: leaveApps = [], isLoading: leaveLoading } = usePendingApprovals()
  const { data: excuses = [], isLoading: excusesLoading } = usePendingExcuses()
  const { data: adjustments = [], isLoading: adjustmentsLoading } = usePendingAdjustments()

  const isLoading = leaveLoading || excusesLoading || adjustmentsLoading
  const pendingLeave = leaveApps.filter((a) => a.status === 'PENDING' || a.status === 'CANCEL_REQUESTED')
  const totalPending = pendingLeave.length + excuses.length + adjustments.length

  const items: RecentItem[] = [
    ...pendingLeave.map((a) => ({
      key: `leave-${a.id}`,
      tab: 'leave' as const,
      icon: a.status === 'CANCEL_REQUESTED' ? Undo2 : CalendarDays,
      title: a.status === 'CANCEL_REQUESTED' ? 'Leave cancellation request' : `${a.leaveType?.name ?? 'Leave'} request`,
      meta: a.employee ? `${a.employee.firstName} ${a.employee.lastName}` : 'Employee',
      when: a.createdAt,
    })),
    ...excuses.map((e) => ({
      key: `excuse-${e.id}`,
      tab: 'excuses' as const,
      icon: Clock,
      title: 'Late arrival excuse',
      meta: `${e.employee.firstName} ${e.employee.lastName} · ${e.lateMinutes}m late`,
      when: e.updatedAt ?? e.date,
    })),
    ...adjustments.map((a) => ({
      key: `adjustment-${a.id}`,
      tab: 'adjustments' as const,
      icon: Clock,
      title: 'Attendance adjustment request',
      meta: `${a.employee.firstName} ${a.employee.lastName} · ${fmtDate(a.date)}`,
      when: a.updatedAt ?? a.date,
    })),
  ]
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent Approval Requests{totalPending > 0 ? ` · ${totalPending} pending` : ''}
        </p>
        <Link href="/approvals" className="text-xs font-medium text-primary hover:underline">
          View all →
        </Link>
      </div>
      {isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState message="No pending approval requests." />
      ) : (
        // Scrolls only when there are more than 3 rows; at 3 or fewer it
        // renders at natural height with no scrollbar.
        <div
          className={cn(
            items.length > 3 && 'max-h-[168px] overflow-y-auto overflow-x-hidden scrollbar-thin pr-1'
          )}
        >
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.key}
                href={`/approvals?tab=${item.tab}`}
                className="-mx-1 flex items-start gap-2.5 rounded px-1 py-2.5 border-b last:border-0 hover:bg-muted/40"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{item.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{item.meta}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDate(item.when)}</span>
              </Link>
            )
          })}
        </div>
      )}
    </Card>
  )
}
