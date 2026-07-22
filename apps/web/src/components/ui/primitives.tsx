import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  LogOut,
  Star,
  Coffee,
  AlertCircle,
  AlertTriangle,
  Ban,
  Briefcase,
  GraduationCap,
  FileText,
  Loader2,
  Check,
  Undo2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-lg border bg-card p-5', className)}>{children}</div>
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  )
}

type StatusConfig = { cls: string; icon: LucideIcon; label: string; spin?: true }

const STATUS_MAP: Record<string, StatusConfig> = {
  // Attendance
  PRESENT: {
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    icon: CheckCircle2,
    label: 'Present',
  },
  LATE: {
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    icon: Clock,
    label: 'Late',
  },
  ABSENT: {
    cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    icon: XCircle,
    label: 'Absent',
  },
  ON_LEAVE: {
    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    icon: Calendar,
    label: 'On Leave',
  },
  HALF_DAY: {
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    icon: Clock,
    label: 'Half Day',
  },
  EARLY_DEPARTURE: {
    cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    icon: LogOut,
    label: 'Early Departure',
  },
  HOLIDAY: {
    cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    icon: Star,
    label: 'Holiday',
  },
  WEEKEND: { cls: 'bg-muted text-muted-foreground', icon: Coffee, label: 'Weekend' },
  // Leave / approval
  PENDING: {
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    icon: Clock,
    label: 'Pending',
  },
  APPROVED: {
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    icon: CheckCircle2,
    label: 'Approved',
  },
  REJECTED: {
    cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    icon: XCircle,
    label: 'Rejected',
  },
  CANCELLED: { cls: 'bg-muted text-muted-foreground', icon: Ban, label: 'Cancelled' },
  CANCEL_REQUESTED: {
    cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
    icon: Undo2,
    label: 'Cancel Requested',
  },
  // Employee status
  ACTIVE: {
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    icon: CheckCircle2,
    label: 'Active',
  },
  PROBATION: {
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    icon: AlertCircle,
    label: 'Probation',
  },
  NOTICE_PERIOD: {
    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    icon: AlertTriangle,
    label: 'Notice Period',
  },
  TERMINATED: {
    cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    icon: Ban,
    label: 'Terminated',
  },
  // Employment type
  FULL_TIME: {
    cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    icon: Briefcase,
    label: 'Full Time',
  },
  PART_TIME: {
    cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    icon: Briefcase,
    label: 'Part Time',
  },
  INTERN: { cls: 'bg-muted text-muted-foreground', icon: GraduationCap, label: 'Intern' },
  CONTRACT: { cls: 'bg-muted text-muted-foreground', icon: FileText, label: 'Contract' },
  // Payroll
  DRAFT: { cls: 'bg-muted text-muted-foreground', icon: FileText, label: 'Draft' },
  PROCESSING: {
    cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    icon: Loader2,
    label: 'Processing',
    spin: true,
  },
  PROCESSED: {
    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
    icon: Check,
    label: 'Processed',
  },
  PAID: {
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    icon: CheckCircle2,
    label: 'Paid',
  },
  // Team display aliases
  IN: {
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    icon: CheckCircle2,
    label: 'In',
  },
  OFF: { cls: 'bg-muted text-muted-foreground', icon: Coffee, label: 'Off' },
}

const FALLBACK_CONFIG: StatusConfig = {
  cls: 'bg-muted text-muted-foreground',
  icon: AlertCircle,
  label: '',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const key = status.toUpperCase()
  const cfg = STATUS_MAP[key] ?? FALLBACK_CONFIG
  const Icon = cfg.icon
  const text = label ?? (cfg.label || status.replace(/_/g, ' ').toLowerCase())
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        cfg.cls
      )}
    >
      <Icon className={cn('h-3 w-3 shrink-0', cfg.spin && 'animate-spin')} />
      {text}
    </span>
  )
}

export function fmtRole(role: string) {
  return role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function RolePill({ role }: { role: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
      <ShieldCheck className="h-2.5 w-2.5" />
      {fmtRole(role)}
    </span>
  )
}

export function Avatar({
  firstName,
  lastName,
  url,
  size = 36,
}: {
  firstName: string
  lastName: string
  url?: string | null
  size?: number
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={`${firstName} ${lastName}`}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-primary font-medium text-primary-foreground"
      // Scale the initials with the avatar size so small avatars (20–24px) don't
      // get oversized letters, and larger ones fill the circle proportionally.
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {firstName[0]}
      {lastName[0]}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  )
}

/**
 * Full-cover veil for a form/modal while its submit mutation is in flight —
 * blurs and dims the content beneath it and shows a spinning icon, so it's
 * obvious at a glance that a submission is in progress. Place inside a
 * `relative`-positioned modal/card container, as the first child, alongside
 * a `<fieldset disabled={isPending} className="contents">` wrapping the rest
 * of that container's form fields — the overlay is the visual signal, the
 * fieldset is what actually blocks interaction with every field/button at
 * once (native browser behavior, no per-control `disabled` prop needed).
 * Also guard the modal's own close paths (backdrop click, X button, Escape)
 * with the same `isPending` check so it can't be dismissed mid-submit.
 */
export function SubmitOverlay({ show, label }: { show: boolean; label?: string }) {
  if (!show) return null
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-card/80 backdrop-blur-[1px]">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, message }: { icon?: LucideIcon; title?: string; message: string }) {
  if (!Icon) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        {message}
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      {title && <p className="text-sm font-medium">{title}</p>}
      <p className={cn('text-muted-foreground', title ? 'max-w-xs text-xs' : 'text-sm')}>{message}</p>
    </div>
  )
}

/** A single pulsing placeholder bar for skeleton loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} />
}

/** Skeleton rows for a list/table loading state (avatar + two text lines + trailing chip). */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2.5 w-56 max-w-full" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}
