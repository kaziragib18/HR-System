'use client'

import { useState, useEffect } from 'react'
import {
  useHolidays,
  useCreateHoliday,
  useUpdateHoliday,
  useDeleteHoliday,
  type Holiday,
} from '@/lib/api/hooks/useHolidays'
import { useOffices, type Office } from '@/lib/api/hooks/useReference'
import { Card, Skeleton, SubmitOverlay } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { Trash2, Pencil, Plus, X, CalendarDays, AlertTriangle, Loader2 } from 'lucide-react'

const field =
  'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
const label = 'mb-1 block text-xs font-medium text-muted-foreground'

const OFFICE_BADGE: Record<string, string> = {
  BD: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  UK: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
}

function fmtHolidayDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function fmtWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long' })
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditHolidayModal({
  holiday,
  offices,
  onClose,
}: {
  holiday: Holiday
  offices: Office[]
  onClose: () => void
}) {
  const update = useUpdateHoliday()
  const [name, setName] = useState(holiday.name)
  const [date, setDate] = useState(holiday.date.slice(0, 10))
  const [officeId, setOfficeId] = useState(
    offices.find((o) => o.code === holiday.office.code)?.id ?? ''
  )
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await update.mutateAsync({
        id: holiday.id,
        name: name.trim(),
        date: new Date(date).toISOString(),
        officeId: officeId || undefined,
      })
      onClose()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Failed to save changes'
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !update.isPending && onClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SubmitOverlay show={update.isPending} label="Saving…" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">Edit holiday</p>
          <button
            onClick={onClose}
            disabled={update.isPending}
            className="rounded-md p-1 hover:bg-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 p-4">
          <fieldset disabled={update.isPending} className="contents">
            <div>
              <label className={label}>Holiday name</label>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={label}>Date</label>
              <input
                type="date"
                className={field}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {offices.length > 1 && (
              <div>
                <label className={label}>Office</label>
                <select
                  className={field}
                  value={officeId}
                  onChange={(e) => setOfficeId(e.target.value)}
                >
                  {offices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.code} — {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || !date || update.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {update.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  )
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteHolidayConfirmModal({
  holiday,
  onClose,
}: {
  holiday: Holiday
  onClose: () => void
}) {
  const del = useDeleteHoliday()
  const [error, setError] = useState('')

  async function handleDelete() {
    setError('')
    try {
      await del.mutateAsync(holiday.id)
      onClose()
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Failed to delete holiday'
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !del.isPending && onClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SubmitOverlay show={del.isPending} label="Deleting…" />
        <div className="p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium">Delete holiday?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This will remove{' '}
                <span className="font-medium text-foreground">&ldquo;{holiday.name}&rdquo;</span> (
                {fmtHolidayDate(holiday.date)}). This can&apos;t be undone.
              </p>
            </div>
          </div>
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={del.isPending}
              className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={del.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {del.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {del.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function HolidaysPanel() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { data: holidays, isLoading } = useHolidays(year)
  const { data: offices = [] } = useOffices()
  const createHoliday = useCreateHoliday()

  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [officeId, setOfficeId] = useState('')

  const [editing, setEditing] = useState<Holiday | null>(null)
  const [deleting, setDeleting] = useState<Holiday | null>(null)

  // Only one active office exists — skip the picker and select it automatically.
  useEffect(() => {
    if (offices.length === 1 && !officeId) setOfficeId(offices[0].id)
  }, [offices, officeId])

  const onAdd = async () => {
    if (!name || !date || !officeId) return
    await createHoliday.mutateAsync({
      officeId,
      name,
      date: new Date(date).toISOString(),
    })
    setName('')
    setDate('')
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <h2 className="mb-3 text-sm font-medium">Add a public holiday</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <label className={label}>Holiday name</label>
            <input
              placeholder="e.g. Eid-ul-Fitr"
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Date</label>
            <input
              type="date"
              className={field}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {offices.length > 1 && (
            <div>
              <label className={label}>Office</label>
              <select
                className={field}
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
              >
                <option value="">Office</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={onAdd}
            disabled={!name || !date || !officeId || createHoliday.isPending}
            className="mb-0 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        {createHoliday.isError && (
          <p className="mt-2 text-xs text-destructive">
            {(createHoliday.error as { response?: { data?: { error?: string } } })?.response?.data
              ?.error ?? 'Failed to add holiday'}
          </p>
        )}
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="text-sm font-medium">Holidays</h2>
          <select
            className={field.replace('w-full', 'w-auto')}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-28 shrink-0" />
                <Skeleton className="h-4 w-20 shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-9 shrink-0 rounded-md" />
                <Skeleton className="h-6 w-14 shrink-0" />
              </div>
            ))}
          </div>
        ) : !holidays?.length ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No holidays configured for {year}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Day</th>
                  <th className="px-4 py-2">Name</th>
                  {offices.length > 1 && <th className="px-4 py-2">Office</th>}
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium tabular-nums">
                      {fmtHolidayDate(h.date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {fmtWeekday(h.date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{h.name}</span>
                    </td>
                    {offices.length > 1 && (
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[10px] font-semibold',
                            OFFICE_BADGE[h.office?.code] ?? 'bg-muted text-muted-foreground'
                          )}
                        >
                          {h.office?.code ?? '—'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(h)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleting(h)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <EditHolidayModal holiday={editing} offices={offices} onClose={() => setEditing(null)} />
      )}
      {deleting && (
        <DeleteHolidayConfirmModal holiday={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  )
}
