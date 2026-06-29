import {
  CheckCircle2, XCircle, Clock, Calendar, LogOut, Star,
  Coffee, AlertCircle, AlertTriangle, Ban, Briefcase,
  GraduationCap, FileText, Loader2, Check, Undo2, type LucideIcon,
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
  PRESENT:         { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', icon: CheckCircle2, label: 'Present' },
  LATE:            { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',         icon: Clock,        label: 'Late' },
  ABSENT:          { cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',                 icon: XCircle,      label: 'Absent' },
  ON_LEAVE:        { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',             icon: Calendar,     label: 'On Leave' },
  HALF_DAY:        { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',         icon: Clock,        label: 'Half Day' },
  EARLY_DEPARTURE: { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',     icon: LogOut,       label: 'Early Departure' },
  HOLIDAY:         { cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',     icon: Star,         label: 'Holiday' },
  WEEKEND:         { cls: 'bg-muted text-muted-foreground',                                                icon: Coffee,       label: 'Weekend' },
  // Leave / approval
  PENDING:         { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',         icon: Clock,        label: 'Pending' },
  APPROVED:        { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', icon: CheckCircle2, label: 'Approved' },
  REJECTED:        { cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',                 icon: XCircle,      label: 'Rejected' },
  CANCELLED:         { cls: 'bg-muted text-muted-foreground',                                                icon: Ban,          label: 'Cancelled' },
  CANCEL_REQUESTED:  { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',     icon: Undo2,        label: 'Cancel Requested' },
  // Employee status
  ACTIVE:          { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', icon: CheckCircle2, label: 'Active' },
  PROBATION:       { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',         icon: AlertCircle,  label: 'Probation' },
  NOTICE_PERIOD:   { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',             icon: AlertTriangle,label: 'Notice Period' },
  TERMINATED:      { cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',                 icon: Ban,          label: 'Terminated' },
  // Employment type
  FULL_TIME:       { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',                 icon: Briefcase,    label: 'Full Time' },
  PART_TIME:       { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',                 icon: Briefcase,    label: 'Part Time' },
  INTERN:          { cls: 'bg-muted text-muted-foreground',                                                icon: GraduationCap,label: 'Intern' },
  CONTRACT:        { cls: 'bg-muted text-muted-foreground',                                                icon: FileText,     label: 'Contract' },
  // Payroll
  DRAFT:           { cls: 'bg-muted text-muted-foreground',                                                icon: FileText,     label: 'Draft' },
  PROCESSING:      { cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',                 icon: Loader2,      label: 'Processing', spin: true },
  PROCESSED:       { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',             icon: Check,        label: 'Processed' },
  PAID:            { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', icon: CheckCircle2, label: 'Paid' },
  // Team display aliases
  IN:              { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', icon: CheckCircle2, label: 'In' },
  OFF:             { cls: 'bg-muted text-muted-foreground',                                                icon: Coffee,       label: 'Off' },
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
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', cfg.cls)}>
      <Icon className={cn('h-3 w-3 shrink-0', cfg.spin && 'animate-spin')} />
      {text}
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
      className="flex items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
      style={{ width: size, height: size }}
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

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
