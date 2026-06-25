'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLeaveTypes, useLeaveBalances, useApplyLeave, type LeaveType, type LeaveBalance } from '@/lib/api/hooks/useLeave'
import { Card, Spinner } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { ArrowLeft, CalendarDays, Info } from 'lucide-react'
import Link from 'next/link'

function workingDaysBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  if (e < s) return 0
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export default function ApplyLeavePage() {
  const router = useRouter()
  const { data: types = [], isLoading: typesLoading } = useLeaveTypes()
  const { data: balances = [] } = useLeaveBalances()
  const apply = useApplyLeave()

  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const selectedType = types.find(t => t.id === leaveTypeId)
  const selectedBalance = balances.find(b => b.leaveTypeId === leaveTypeId)
  const days = workingDaysBetween(startDate, endDate || startDate)

  const available = selectedBalance
    ? Number(selectedBalance.entitled) - Number(selectedBalance.taken) - Number(selectedBalance.pending)
    : null

  const today = new Date().toISOString().split('T')[0]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!leaveTypeId) { setError('Please select a leave type'); return }
    if (!startDate) { setError('Please select a start date'); return }
    if (days <= 0) { setError('No working days in selected range'); return }

    try {
      await apply.mutateAsync({
        leaveTypeId,
        startDate,
        endDate: endDate || startDate,
        reason: reason || undefined,
      })
      router.push('/leave')
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to apply'
        : 'Failed to apply'
      setError(msg)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/leave" className="rounded-md p-1.5 hover:bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Apply for Leave</h1>
          <p className="text-sm text-muted-foreground">Submit a new leave request</p>
        </div>
      </div>

      <Card>
        {typesLoading ? (
          <Spinner />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Leave type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Leave Type</label>
              <select
                value={leaveTypeId}
                onChange={e => { setLeaveTypeId(e.target.value); setError('') }}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select leave type…</option>
                {types.map((t: LeaveType) => {
                  const bal = balances.find((b: LeaveBalance) => b.leaveTypeId === t.id)
                  const avail = bal ? Number(bal.entitled) - Number(bal.taken) - Number(bal.pending) : null
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name} {avail !== null ? `(${avail} days available)` : ''}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Balance preview */}
            {selectedType && selectedBalance && (
              <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">{selectedType.name} balance</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Entitled: {Number(selectedBalance.entitled)} ·
                    Taken: {Number(selectedBalance.taken)} ·
                    Pending: {Number(selectedBalance.pending)} ·
                    <span className="ml-1 font-medium text-foreground">
                      Available: {available}
                    </span>
                  </p>
                  {selectedType.minNoticeDays > 0 && (
                    <p className="mt-0.5 text-amber-600 dark:text-amber-400">
                      ⚠ Requires {selectedType.minNoticeDays} day(s) advance notice
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  min={today}
                  onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">End Date</label>
                <input
                  type="date"
                  value={endDate || startDate}
                  min={startDate || today}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Days preview */}
            {startDate && days >= 0 && (
              <div className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                available !== null && days > available
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              )}>
                <CalendarDays className="h-4 w-4" />
                {days} working day{days !== 1 ? 's' : ''} selected
                {available !== null && days > available && ` — exceeds balance by ${days - available}`}
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Reason <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="Briefly describe the reason for your leave…"
                className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            <div className="flex gap-3">
              <Link
                href="/leave"
                className="flex-1 rounded-lg border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={apply.isPending || (available !== null && days > available) || days <= 0}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {apply.isPending ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
