'use client'

import { useState } from 'react'
import { Card, Skeleton } from '@/components/ui/primitives'
import { Input, Textarea } from '@/components/ui/section-card'
import { formatDate } from '@hr-system/utils'
import { Briefcase, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import {
  useWorkExperiences,
  useCreateWorkExperience,
  useUpdateWorkExperience,
  useDeleteWorkExperience,
} from '@/lib/api/hooks/useEmployeeProfile'
import type { WorkExperience } from '@hr-system/types'

interface FormState {
  companyName: string
  jobTitle: string
  location: string
  startDate: string
  endDate: string
  isCurrent: boolean
  description: string
}

const BLANK: FormState = { companyName: '', jobTitle: '', location: '', startDate: '', endDate: '', isCurrent: false, description: '' }

function toForm(w: WorkExperience): FormState {
  return {
    companyName: w.companyName,
    jobTitle: w.jobTitle,
    location: w.location ?? '',
    startDate: w.startDate.slice(0, 10),
    endDate: w.endDate ? w.endDate.slice(0, 10) : '',
    isCurrent: w.isCurrent,
    description: w.description ?? '',
  }
}

export function WorkExperienceSection({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const { data: items = [], isLoading } = useWorkExperiences(employeeId)
  const create = useCreateWorkExperience(employeeId)
  const update = useUpdateWorkExperience(employeeId)
  const remove = useDeleteWorkExperience(employeeId)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')

  function startAdd() {
    setEditingId(null)
    setForm(BLANK)
    setShowForm(true)
    setError('')
  }

  function startEdit(w: WorkExperience) {
    setEditingId(w.id)
    setForm(toForm(w))
    setShowForm(true)
    setError('')
  }

  async function save() {
    if (!form.companyName.trim() || !form.jobTitle.trim() || !form.startDate) return
    setError('')
    const payload = {
      companyName: form.companyName.trim(),
      jobTitle: form.jobTitle.trim(),
      location: form.location.trim() || undefined,
      startDate: form.startDate,
      endDate: form.isCurrent ? undefined : form.endDate || undefined,
      isCurrent: form.isCurrent,
      description: form.description.trim() || undefined,
    }
    try {
      if (editingId) await update.mutateAsync({ id: editingId, ...payload })
      else await create.mutateAsync(payload)
      setShowForm(false)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save')
    }
  }

  const saving = create.isPending || update.isPending

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Work Experience ({items.length})</h3>
        {canEdit && !showForm && (
          <button
            onClick={startAdd}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>

      {showForm ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Company" value={form.companyName} onChange={v => setForm(s => ({ ...s, companyName: v }))} />
            <Input label="Job title" value={form.jobTitle} onChange={v => setForm(s => ({ ...s, jobTitle: v }))} />
            <Input label="Location" value={form.location} onChange={v => setForm(s => ({ ...s, location: v }))} />
            <Input label="Start date" type="date" value={form.startDate} onChange={v => setForm(s => ({ ...s, startDate: v }))} />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.isCurrent}
                onChange={e => setForm(s => ({ ...s, isCurrent: e.target.checked }))}
              />
              I currently work here
            </label>
            {!form.isCurrent && (
              <Input label="End date" type="date" value={form.endDate} onChange={v => setForm(s => ({ ...s, endDate: v }))} />
            )}
          </div>
          <Textarea label="Description" value={form.description} onChange={v => setForm(s => ({ ...s, description: v }))} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving || !form.companyName.trim() || !form.jobTitle.trim() || !form.startDate}
              className="flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={saving} className="rounded px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
              Cancel
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No work experience added yet.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {items.map(w => (
            <li key={w.id} className="group flex items-start gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Briefcase className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{w.jobTitle} · {w.companyName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(w.startDate)} – {w.isCurrent ? 'Present' : w.endDate ? formatDate(w.endDate) : '—'}
                  {w.location ? ` · ${w.location}` : ''}
                </p>
                {w.description && <p className="mt-1 text-xs text-muted-foreground">{w.description}</p>}
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => startEdit(w)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {confirmDeleteId === w.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { remove.mutate(w.id); setConfirmDeleteId(null) }}
                        className="text-[10px] font-medium text-destructive hover:underline"
                      >
                        Confirm
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(w.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
