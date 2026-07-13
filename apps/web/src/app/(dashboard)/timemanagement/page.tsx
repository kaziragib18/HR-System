'use client'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import {
  useMyMonthAttendance,
  useAllAttendance,
  useManualEntry,
  useRequestAdjustment,
  useUpdateAdjustmentRequest,
  type AttendanceRecord,
} from '@/lib/api/hooks/useAttendance'
import { useEmployees } from '@/lib/api/hooks/useEmployees'
import { useDepartments } from '@/lib/api/hooks/useDepartments'
import { useAuthStore } from '@/store/auth.store'
import { Card, Avatar, Spinner } from '@/components/ui/primitives'
import { UserRole } from '@hr-system/types'
import { BD_SHIFT, UK_SHIFT } from '@hr-system/utils'
import { apiClient } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  Download,
  Edit2,
  X,
  ArrowLeft,
  Info,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MANAGER_ROLES = [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER, UserRole.DEPT_HEAD, UserRole.TEAM_LEAD]
const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER]

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  PRESENT:          { label: 'Present',       cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  LATE:             { label: 'Late',           cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  EARLY_DEPARTURE:  { label: 'Early Dep.',     cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  HALF_DAY:         { label: 'Half Day',       cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  ABSENT:           { label: 'Absent',         cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  ON_LEAVE:         { label: 'On Leave',       cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  HOLIDAY:          { label: 'Holiday',        cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
  WEEKEND:          { label: 'Weekend',        cls: 'bg-muted text-muted-foreground' },
  PENDING:          { label: 'Pending',        cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  APPROVED:         { label: 'Approved',       cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  REJECTED:         { label: 'Rejected',       cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayRow {
  day: number
  dateStr: string
  dow: number
  isWeekend: boolean
  isFuture: boolean
  record: AttendanceRecord | null
}

interface EditTarget {
  dateStr: string
  employeeId: string
  record: AttendanceRecord | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMonthRows(year: number, month: number, records: AttendanceRecord[]): DayRow[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const recMap: Record<string, AttendanceRecord> = {}
  for (const r of records) recMap[r.date.slice(0, 10)] = r

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const date = new Date(Date.UTC(year, month - 1, day))
    const dateStr = date.toISOString().slice(0, 10)
    const dow = date.getUTCDay()
    return {
      day,
      dateStr,
      dow,
      isWeekend: dow === 0 || dow === 6,
      isFuture: date > todayEnd,
      record: recMap[dateStr] ?? null,
    }
  })
}

function effectiveStatus(row: DayRow): string {
  if (row.record) return row.record.status
  if (row.isWeekend) return 'WEEKEND'
  if (row.isFuture) return ''
  return 'ABSENT'
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtMins(mins: number | null | undefined): string {
  if (!mins) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function computeStats(rows: DayRow[]) {
  let present = 0, absent = 0, late = 0, onLeave = 0, totalMins = 0, otMins = 0
  for (const row of rows) {
    if (row.isFuture) continue
    const s = effectiveStatus(row)
    if (s === 'PRESENT') present++
    else if (s === 'LATE' || s === 'EARLY_DEPARTURE') { present++; late++ }
    else if (s === 'HALF_DAY') { present++; late++ }
    else if (s === 'ABSENT') absent++
    else if (s === 'ON_LEAVE') onLeave++
    if (row.record) {
      totalMins += row.record.workingMinutes ?? 0
      otMins += row.record.overtimeMinutes ?? 0
    }
  }
  return { present, absent, late, onLeave, totalMins, otMins }
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

function rowsToSheet(rows: DayRow[]) {
  return rows.map(r => ({
    'Date': r.dateStr,
    'Day': DAYS[r.dow],
    'Status': STATUS_CONFIG[effectiveStatus(r)]?.label ?? '—',
    'Check-in': fmtTime(r.record?.checkIn),
    'Check-out': fmtTime(r.record?.checkOut),
    'Working Hours': fmtMins(r.record?.workingMinutes),
    'Late (mins)': r.record?.lateMinutes ?? '—',
    'Overtime (mins)': r.record?.overtimeMinutes ?? '—',
    'Source': r.record?.source ?? '—',
  }))
}

async function exportAttendance(
  type: 'month' | 'year',
  opts: {
    employeeId: string
    firstName: string
    lastName: string
    month: number
    year: number
    currentRows: DayRow[]
    isOwnData: boolean
  },
) {
  const name = `${opts.firstName}_${opts.lastName}`.replace(/\s+/g, '_')
  const wb = XLSX.utils.book_new()

  if (type === 'month') {
    const ws = XLSX.utils.json_to_sheet(rowsToSheet(opts.currentRows))
    XLSX.utils.book_append_sheet(wb, ws, `${MONTH_SHORT[opts.month - 1]} ${opts.year}`)
    XLSX.writeFile(wb, `attendance_${name}_${opts.year}_${String(opts.month).padStart(2, '0')}.xlsx`)
    return
  }

  // Full year: fetch each month
  const endpoint = opts.isOwnData ? '/attendance/me' : '/attendance'
  for (let m = 1; m <= 12; m++) {
    const qs = opts.isOwnData
      ? `?month=${m}&year=${opts.year}`
      : `?employeeId=${opts.employeeId}&month=${m}&year=${opts.year}&limit=31`
    const { data } = await apiClient.get(endpoint + qs)
    const monthRows = buildMonthRows(opts.year, m, (data.data ?? []) as AttendanceRecord[])
    const ws = XLSX.utils.json_to_sheet(rowsToSheet(monthRows))
    XLSX.utils.book_append_sheet(wb, ws, MONTH_SHORT[m - 1])
  }
  XLSX.writeFile(wb, `attendance_${name}_${opts.year}.xlsx`)
}

// Bulk export: all employees or a department — one sheet per employee
async function exportBulkAttendance(
  type: 'month' | 'year',
  opts: {
    deptId?: string
    label: string  // "All Departments" or dept name
    month: number
    year: number
  },
) {
  async function fetchForMonth(m: number) {
    const p = new URLSearchParams({ month: String(m), year: String(opts.year), limit: '1500' })
    if (opts.deptId) p.set('departmentId', opts.deptId)
    const { data } = await apiClient.get(`/attendance?${p}`)
    return (data.data ?? []) as AttendanceRecord[]
  }

  function groupByEmployee(records: AttendanceRecord[]) {
    const map = new Map<string, { firstName: string; lastName: string; records: AttendanceRecord[] }>()
    for (const r of records) {
      if (!r.employee) continue
      if (!map.has(r.employeeId)) {
        map.set(r.employeeId, {
          firstName: r.employee.firstName,
          lastName: r.employee.lastName,
          records: [],
        })
      }
      map.get(r.employeeId)!.records.push(r)
    }
    return map
  }

  const wb = XLSX.utils.book_new()
  const safeLabel = opts.label.replace(/[/\\?*[\]]/g, '_').slice(0, 20)

  if (type === 'month') {
    const records = await fetchForMonth(opts.month)
    const empMap = groupByEmployee(records)
    for (const [, { firstName, lastName, records: empRecords }] of empMap) {
      const rows = buildMonthRows(opts.year, opts.month, empRecords)
      const ws = XLSX.utils.json_to_sheet(rowsToSheet(rows))
      const sheetName = `${firstName} ${lastName}`.slice(0, 31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    }
    XLSX.writeFile(wb, `attendance_${safeLabel}_${opts.year}_${String(opts.month).padStart(2, '0')}.xlsx`)
    return
  }

  // Full year: fetch each month, accumulate per employee
  const empYearData = new Map<string, { firstName: string; lastName: string; monthRecords: Map<number, AttendanceRecord[]> }>()
  for (let m = 1; m <= 12; m++) {
    const records = await fetchForMonth(m)
    for (const r of records) {
      if (!r.employee) continue
      if (!empYearData.has(r.employeeId)) {
        empYearData.set(r.employeeId, { firstName: r.employee.firstName, lastName: r.employee.lastName, monthRecords: new Map() })
      }
      const emp = empYearData.get(r.employeeId)!
      if (!emp.monthRecords.has(m)) emp.monthRecords.set(m, [])
      emp.monthRecords.get(m)!.push(r)
    }
  }

  for (const [, { firstName, lastName, monthRecords }] of empYearData) {
    const allRows: Record<string, unknown>[] = []
    for (let m = 1; m <= 12; m++) {
      const rows = buildMonthRows(opts.year, m, monthRecords.get(m) ?? [])
      for (const row of rowsToSheet(rows)) {
        allRows.push({ Month: MONTHS[m - 1], ...row })
      }
    }
    const ws = XLSX.utils.json_to_sheet(allRows)
    XLSX.utils.book_append_sheet(wb, ws, `${firstName} ${lastName}`.slice(0, 31))
  }
  XLSX.writeFile(wb, `attendance_${safeLabel}_${opts.year}.xlsx`)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

function StatsRow({ rows }: { rows: DayRow[] }) {
  const s = computeStats(rows)
  const items = [
    { label: 'Present',  value: s.present,           cls: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Absent',   value: s.absent,             cls: 'text-red-600 dark:text-red-400' },
    { label: 'Late',     value: s.late,               cls: 'text-amber-600 dark:text-amber-400' },
    { label: 'On Leave', value: s.onLeave,            cls: 'text-blue-600 dark:text-blue-400' },
    { label: 'Total Hrs', value: fmtMins(s.totalMins), cls: 'text-foreground' },
    { label: 'Overtime', value: fmtMins(s.otMins),    cls: 'text-violet-600 dark:text-violet-400' },
  ]
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {items.map(item => (
        <Card key={item.label} className="flex flex-col items-center justify-center py-3 px-2">
          <p className={cn('text-xl font-bold tabular-nums', item.cls)}>{item.value}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{item.label}</p>
        </Card>
      ))}
    </div>
  )
}

function DailyTable({
  rows,
  canEdit,
  canRequest,
  todayStr,
  onEdit,
  onRequest,
}: {
  rows: DayRow[]
  canEdit: boolean
  canRequest?: boolean
  todayStr?: string
  onEdit?: (row: DayRow) => void
  onRequest?: (row: DayRow) => void
}) {
  const showAction = canEdit || canRequest
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pl-1 text-left">Date</th>
            <th className="py-2 text-left">Day</th>
            <th className="py-2 text-left">Status</th>
            <th className="py-2 text-left">Check-in</th>
            <th className="py-2 text-left">Check-out</th>
            <th className="py-2 text-left">Hours</th>
            <th className="py-2 text-left">Late</th>
            <th className="py-2 text-left">OT</th>
            {showAction && <th className="py-2 text-left">{canEdit ? 'Edit' : 'Request'}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const status = effectiveStatus(row)
            const isDim = row.isWeekend || status === 'HOLIDAY'
            const isFuture = row.isFuture
            const isPastDay = !!todayStr && row.dateStr < todayStr
            const adjustmentStatus = row.record?.adjustmentStatus ?? null
            return (
              <tr
                key={row.dateStr}
                className={cn(
                  'border-b transition-colors last:border-0',
                  isDim || isFuture ? 'opacity-40' : 'hover:bg-muted/30',
                )}
              >
                <td className="py-2.5 pl-1 text-xs font-medium tabular-nums">
                  {String(row.day).padStart(2, '0')} {MONTH_SHORT[Number(row.dateStr.slice(5, 7)) - 1]}
                </td>
                <td className="py-2.5 text-xs text-muted-foreground">{DAYS[row.dow]}</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-1.5">
                    {status ? <StatusPill status={status} /> : <span className="text-xs text-muted-foreground">—</span>}
                    {row.record?.adjustmentReason && (
                      <span title={`Adjustment reason: ${row.record.adjustmentReason}`}>
                        <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 font-mono text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    {fmtTime(row.record?.checkIn)}
                    {row.record?.source === 'MANUAL' && (
                      <span
                        title="Manually entered / corrected via an approved adjustment request"
                        className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        Manual
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-2.5 font-mono text-xs">{fmtTime(row.record?.checkOut)}</td>
                <td className="py-2.5 text-xs">{fmtMins(row.record?.workingMinutes)}</td>
                <td className="py-2.5 text-xs text-amber-600 dark:text-amber-400">
                  {row.record?.lateMinutes ? `${row.record.lateMinutes}m` : '—'}
                </td>
                <td className="py-2.5 text-xs text-violet-600 dark:text-violet-400">
                  {row.record?.overtimeMinutes ? `${row.record.overtimeMinutes}m` : '—'}
                </td>
                {showAction && (
                  <td className="py-2.5">
                    {canEdit ? (
                      !row.isFuture && !row.isWeekend && status !== 'HOLIDAY' && (
                        <button
                          onClick={() => onEdit?.(row)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )
                    ) : adjustmentStatus ? (
                      <button
                        onClick={() => onRequest?.(row)}
                        disabled={adjustmentStatus === 'APPROVED'}
                        className="disabled:cursor-default"
                        title={adjustmentStatus === 'PENDING' ? 'Edit your pending request' : adjustmentStatus === 'REJECTED' ? 'Submit a new request' : undefined}
                      >
                        <StatusPill status={adjustmentStatus} />
                      </button>
                    ) : (
                      isPastDay && !row.isWeekend && status !== 'HOLIDAY' && (
                        <button
                          onClick={() => onRequest?.(row)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      )
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function EditModal({
  target,
  onClose,
  onSave,
  saving,
}: {
  target: EditTarget
  onClose: () => void
  onSave: (checkIn: string | null, checkOut: string | null, remarks: string) => Promise<void>
  saving: boolean
}) {
  const [checkIn, setCheckIn] = useState(
    target.record?.checkIn ? new Date(target.record.checkIn).toISOString().slice(11, 16) : ''
  )
  const [checkOut, setCheckOut] = useState(
    target.record?.checkOut ? new Date(target.record.checkOut).toISOString().slice(11, 16) : ''
  )
  const [remarks, setRemarks] = useState(target.record?.remarks ?? '')

  function toISO(time: string): string | null {
    if (!time) return null
    return `${target.dateStr}T${time}:00.000Z`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">Edit Attendance</p>
            <p className="text-xs text-muted-foreground">{target.dateStr}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Check-in time (UTC)</label>
            <input
              type="time"
              value={checkIn}
              onChange={e => setCheckIn(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Check-out time (UTC)</label>
            <input
              type="time"
              value={checkOut}
              onChange={e => setCheckOut(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Reason for manual entry…"
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="flex gap-2 border-t px-4 py-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(toISO(checkIn), toISO(checkOut), remarks)}
            disabled={saving}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RequestAdjustmentModal({
  target,
  isEdit,
  officeCode,
  onClose,
  onSubmit,
  submitting,
}: {
  target: EditTarget
  isEdit: boolean
  officeCode?: string
  onClose: () => void
  onSubmit: (input: { requestedCheckIn: string; requestedCheckOut: string; reason: string }) => Promise<void>
  submitting: boolean
}) {
  const officeShift = officeCode === 'BD' ? BD_SHIFT : UK_SHIFT
  const [checkIn, setCheckIn] = useState(
    target.record?.requestedCheckIn
      ? new Date(target.record.requestedCheckIn).toISOString().slice(11, 16)
      : target.record?.checkIn ? new Date(target.record.checkIn).toISOString().slice(11, 16) : ''
  )
  const [checkOut, setCheckOut] = useState(
    target.record?.requestedCheckOut
      ? new Date(target.record.requestedCheckOut).toISOString().slice(11, 16)
      : target.record?.checkOut ? new Date(target.record.checkOut).toISOString().slice(11, 16) : ''
  )
  const [reason, setReason] = useState(target.record?.adjustmentReason ?? '')
  const [error, setError] = useState('')

  const currentlyAbsent = !target.record?.checkIn && !target.record?.checkOut
  const noteText = currentlyAbsent
    ? 'This day is currently marked Absent. Provide both times if you forgot to check in and out — your manager can approve it to Present.'
    : 'This will update the existing check-in/check-out time for this day.'

  function toISO(time: string): string {
    return `${target.dateStr}T${time}:00.000Z`
  }

  async function handleSubmit() {
    if (!checkIn && !checkOut) { setError('Provide a proposed check-in or check-out time'); return }
    if (reason.trim().length < 5) { setError('Reason must be at least 5 characters'); return }
    setError('')
    await onSubmit({
      requestedCheckIn: checkIn ? toISO(checkIn) : '',
      requestedCheckOut: checkOut ? toISO(checkOut) : '',
      reason: reason.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">{isEdit ? 'Edit Adjustment Request' : 'Request Attendance Adjustment'}</p>
            <p className="text-xs text-muted-foreground">{target.dateStr}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {noteText}
          </p>
          <p className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Office hours{officeCode ? ` (${officeCode})` : ''}</span>
            <span className="font-medium text-foreground">{officeShift.startTime} – {officeShift.endTime}</span>
          </p>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{error}</p>}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Proposed check-in time (UTC)</label>
            <input
              type="time"
              value={checkIn}
              onChange={e => setCheckIn(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Proposed check-out time (UTC)</label>
            <input
              type="time"
              value={checkOut}
              onChange={e => setCheckOut(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Reason</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why does this record need correcting?"
              rows={3}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="flex gap-2 border-t px-4 py-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : isEdit ? 'Update Request' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TimeManagementPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [selectedEmp, setSelectedEmp] = useState<{
    id: string; firstName: string; lastName: string; department?: string
  } | null>(null)
  const [search, setSearch] = useState('')
  const [deptId, setDeptId] = useState('')
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [requestTarget, setRequestTarget] = useState<EditTarget | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const [exporting, setExporting] = useState(false)

  const user = useAuthStore(s => s.user)
  const isManager = !!user && MANAGER_ROLES.includes(user.role as UserRole)
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role as UserRole)
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  // Employee self data
  const { data: myRecords = [], isLoading: myLoading } = useMyMonthAttendance(month, year)

  // Admin: employee list for selection
  const { data: empResult, isLoading: empLoading } = useEmployees(
    isManager
      ? { search: search || undefined, departmentId: deptId || undefined, limit: 100 }
      : {}
  )
  const employeeList = empResult?.data ?? []

  // Admin: selected employee's records
  const { data: adminRecords = [], isLoading: adminLoading } = useAllAttendance(
    isManager && selectedEmp ? { employeeId: selectedEmp.id, month, year, limit: 31 } : undefined
  )

  const { data: departments = [] } = useDepartments()
  const manualEntry = useManualEntry()
  const requestAdjustment = useRequestAdjustment()
  const updateAdjustmentRequest = useUpdateAdjustmentRequest()

  // Which records/rows to display
  const activeRecords: AttendanceRecord[] = isManager && selectedEmp ? adminRecords : myRecords
  const isLoading = isManager && selectedEmp ? adminLoading : myLoading
  const rows = buildMonthRows(year, month, activeRecords)
  const showDetail = !isManager || !!selectedEmp
  const isOwnRecords = !selectedEmp || selectedEmp.id === user?.employeeId
  const todayStr = now.toISOString().slice(0, 10)

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  async function handleSave(checkIn: string | null, checkOut: string | null, remarks: string) {
    if (!editTarget) return
    await manualEntry.mutateAsync({
      employeeId: editTarget.employeeId,
      date: editTarget.dateStr,
      checkIn,
      checkOut,
      remarks: remarks || undefined,
    })
    setEditTarget(null)
  }

  async function handleRequestSubmit(input: { requestedCheckIn: string; requestedCheckOut: string; reason: string }) {
    if (!requestTarget) return
    const isEdit = requestTarget.record?.adjustmentStatus === 'PENDING'
    const payload = {
      date: requestTarget.dateStr,
      requestedCheckIn: input.requestedCheckIn || undefined,
      requestedCheckOut: input.requestedCheckOut || undefined,
      reason: input.reason,
    }
    if (isEdit && requestTarget.record) {
      await updateAdjustmentRequest.mutateAsync({ id: requestTarget.record.id, ...payload })
    } else {
      await requestAdjustment.mutateAsync(payload)
    }
    setRequestTarget(null)
  }

  async function handleExport(type: 'month' | 'year') {
    setShowExportMenu(false)
    setExporting(true)
    try {
      const isOwnData = !isManager || !selectedEmp
      await exportAttendance(type, {
        employeeId: isOwnData ? user!.employeeId : selectedEmp!.id,
        firstName: isOwnData ? (user?.firstName ?? '') : selectedEmp!.firstName,
        lastName: isOwnData ? (user?.lastName ?? '') : selectedEmp!.lastName,
        month,
        year,
        currentRows: rows,
        isOwnData,
      })
    } finally {
      setExporting(false)
    }
  }

  async function handleBulkExport(type: 'month' | 'year') {
    setShowBulkMenu(false)
    setExporting(true)
    const activeDept = departments.find(d => d.id === deptId)
    try {
      await exportBulkAttendance(type, {
        deptId: deptId || undefined,
        label: activeDept ? activeDept.name : 'All_Departments',
        month,
        year,
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {isManager && selectedEmp && (
            <button
              onClick={() => setSelectedEmp(null)}
              className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> All employees
            </button>
          )}
          <h1 className="text-xl font-semibold">
            Time Management
            {selectedEmp && (
              <span className="ml-2 font-normal text-muted-foreground">
                — {selectedEmp.firstName} {selectedEmp.lastName}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {showDetail ? 'Monthly attendance records' : 'Select an employee to view their records'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month picker */}
          <div className="flex items-center gap-1 rounded-lg border bg-card px-2 py-1.5">
            <button onClick={prevMonth} className="rounded p-1 hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] text-center text-sm font-medium">
              {MONTHS[month - 1]} {year}
            </span>
            <button
              onClick={nextMonth}
              disabled={isCurrentMonth}
              className="rounded p-1 hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Export — individual (detail view) */}
          {showDetail && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(v => !v)}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Exporting…' : 'Export'}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showExportMenu && (
                <>
                  <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border bg-card shadow-lg">
                    <button onClick={() => handleExport('month')} className="flex w-full items-center gap-2 rounded-t-lg px-3 py-2 text-sm hover:bg-muted">
                      Current month
                    </button>
                    <button onClick={() => handleExport('year')} className="flex w-full items-center gap-2 rounded-b-lg px-3 py-2 text-sm hover:bg-muted">
                      Full year ({year})
                    </button>
                  </div>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                </>
              )}
            </div>
          )}

          {/* Bulk export — admin list view */}
          {isAdmin && !selectedEmp && (
            <div className="relative">
              <button
                onClick={() => setShowBulkMenu(v => !v)}
                disabled={exporting}
                className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Exporting…' : (deptId ? departments.find(d => d.id === deptId)?.name ?? 'Dept' : 'All Depts')}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showBulkMenu && (
                <>
                  <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border bg-card shadow-lg">
                    <div className="border-b px-3 py-1.5">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                        {deptId ? (departments.find(d => d.id === deptId)?.name ?? 'Department') : 'All Departments'}
                      </p>
                    </div>
                    <button onClick={() => handleBulkExport('month')} className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
                      Current month ({MONTHS[month - 1]})
                    </button>
                    <button onClick={() => handleBulkExport('year')} className="flex w-full items-center gap-2 rounded-b-lg px-3 py-2 text-sm hover:bg-muted">
                      Full year ({year})
                    </button>
                  </div>
                  <div className="fixed inset-0 z-10" onClick={() => setShowBulkMenu(false)} />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Admin filters + employee list */}
      {isManager && !selectedEmp && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or ID…"
                className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              value={deptId}
              onChange={e => setDeptId(e.target.value)}
              className="rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <Card>
            {empLoading ? (
              <Spinner />
            ) : employeeList.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No employees found</div>
            ) : (
              <div className="divide-y">
                {employeeList.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() =>
                      setSelectedEmp({
                        id: emp.id,
                        firstName: emp.firstName,
                        lastName: emp.lastName,
                        department: emp.department?.name,
                      })
                    }
                    className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <Avatar firstName={emp.firstName} lastName={emp.lastName} size={32} url={emp.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emp.employeeId}
                        {emp.department?.name && ` · ${emp.department.name}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Detail view: stats + daily table */}
      {showDetail && (
        <>
          {!isLoading && <StatsRow rows={rows} />}

          <Card>
            {isLoading ? (
              <div className="py-12 text-center">
                <Spinner />
              </div>
            ) : (
              <DailyTable
                rows={rows}
                canEdit={isAdmin && !!selectedEmp}
                canRequest={isOwnRecords && !(isAdmin && !!selectedEmp)}
                todayStr={todayStr}
                onEdit={row =>
                  setEditTarget({
                    dateStr: row.dateStr,
                    employeeId: selectedEmp!.id,
                    record: row.record,
                  })
                }
                onRequest={row =>
                  setRequestTarget({
                    dateStr: row.dateStr,
                    employeeId: user!.employeeId,
                    record: row.record,
                  })
                }
              />
            )}
          </Card>
        </>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
          saving={manualEntry.isPending}
        />
      )}

      {/* Request adjustment modal */}
      {requestTarget && (
        <RequestAdjustmentModal
          target={requestTarget}
          isEdit={requestTarget.record?.adjustmentStatus === 'PENDING'}
          officeCode={user?.officeCode}
          onClose={() => setRequestTarget(null)}
          onSubmit={handleRequestSubmit}
          submitting={requestAdjustment.isPending || updateAdjustmentRequest.isPending}
        />
      )}
    </div>
  )
}
