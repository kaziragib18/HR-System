'use client'

import { useState } from 'react'
import { Card, Skeleton } from '@/components/ui/primitives'
import { Input, Textarea } from '@/components/ui/section-card'
import { formatDate } from '@hr-system/utils'
import { GraduationCap, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import {
  useEducationHistory,
  useCreateEducation,
  useUpdateEducation,
  useDeleteEducation,
} from '@/lib/api/hooks/useEmployeeProfile'
import type { Education } from '@hr-system/types'

interface FormState {
  institution: string
  degree: string
  fieldOfStudy: string
  startDate: string
  endDate: string
  grade: string
  description: string
}

const BLANK: FormState = { institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', grade: '', description: '' }

function toForm(e: Education): FormState {
  return {
    institution: e.institution,
    degree: e.degree,
    fieldOfStudy: e.fieldOfStudy ?? '',
    startDate: e.startDate.slice(0, 10),
    endDate: e.endDate ? e.endDate.slice(0, 10) : '',
    grade: e.grade ?? '',
    description: e.description ?? '',
  }
}

export function EducationSection({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const { data: items = [], isLoading } = useEducationHistory(employeeId)
  const create = useCreateEducation(employeeId)
  const update = useUpdateEducation(employeeId)
  const remove = useDeleteEducation(employeeId)

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

  function startEdit(e: Education) {
    setEditingId(e.id)
    setForm(toForm(e))
    setShowForm(true)
    setError('')
  }

  async function save() {
    if (!form.institution.trim() || !form.degree.trim() || !form.startDate) return
    setError('')
    const payload = {
      institution: form.institution.trim(),
      degree: form.degree.trim(),
      fieldOfStudy: form.fieldOfStudy.trim() || undefined,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      grade: form.grade.trim() || undefined,
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
        <h3 className="text-sm font-medium">Education ({items.length})</h3>
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
            <Input label="Institution" value={form.institution} onChange={v => setForm(s => ({ ...s, institution: v }))} />
            <Input label="Degree" value={form.degree} onChange={v => setForm(s => ({ ...s, degree: v }))} />
            <Input label="Field of study" value={form.fieldOfStudy} onChange={v => setForm(s => ({ ...s, fieldOfStudy: v }))} />
            <Input label="Grade" value={form.grade} onChange={v => setForm(s => ({ ...s, grade: v }))} />
            <Input label="Start date" type="date" value={form.startDate} onChange={v => setForm(s => ({ ...s, startDate: v }))} />
            <Input label="End date" type="date" value={form.endDate} onChange={v => setForm(s => ({ ...s, endDate: v }))} />
          </div>
          <Textarea label="Description" value={form.description} onChange={v => setForm(s => ({ ...s, description: v }))} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving || !form.institution.trim() || !form.degree.trim() || !form.startDate}
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
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No education history added yet.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {items.map(e => (
            <li key={e.id} className="group flex items-start gap-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{e.degree} · {e.institution}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(e.startDate)} – {e.endDate ? formatDate(e.endDate) : '—'}
                  {e.grade ? ` · ${e.grade}` : ''}
                </p>
                {e.description && <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>}
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => startEdit(e)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {confirmDeleteId === e.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { remove.mutate(e.id); setConfirmDeleteId(null) }}
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
                      onClick={() => setConfirmDeleteId(e.id)}
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
