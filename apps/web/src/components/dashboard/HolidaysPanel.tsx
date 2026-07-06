'use client'

import { useState, useMemo } from 'react'
import { useHolidays, useCreateHoliday, useDeleteHoliday } from '@/lib/api/hooks/useHolidays'
import { useDepartments } from '@/lib/api/hooks/useDepartments'
import { Card, Spinner, EmptyState } from '@/components/ui/primitives'
import { formatDate } from '@hr-system/utils'
import { Trash2, Plus } from 'lucide-react'

const field =
  'rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'

export function HolidaysPanel() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const { data: holidays, isLoading } = useHolidays(year)
  const { data: departments } = useDepartments()
  const createHoliday = useCreateHoliday()
  const deleteHoliday = useDeleteHoliday()

  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [officeId, setOfficeId] = useState('')

  const offices = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>()
    departments?.forEach((d) => map.set(d.office.id, d.office))
    return [...map.values()]
  }, [departments])

  const onAdd = async () => {
    if (!name || !date || !officeId) return
    await createHoliday.mutateAsync({ officeId, name, date: new Date(date).toISOString() })
    setName('')
    setDate('')
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <h2 className="mb-3 text-sm font-medium">Add a public holiday</h2>
        <div className="flex flex-wrap items-end gap-2">
          <input
            placeholder="Holiday name"
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          <select className={field} value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
            <option value="">Office…</option>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code}
              </option>
            ))}
          </select>
          <button
            onClick={onAdd}
            disabled={!name || !date || !officeId || createHoliday.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
            className={field}
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
          <Spinner />
        ) : !holidays?.length ? (
          <EmptyState message={`No holidays configured for ${year}.`} />
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{h.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(h.date)}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => deleteHoliday.mutate(h.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
