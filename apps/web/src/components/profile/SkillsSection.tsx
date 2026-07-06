'use client'

import { useState } from 'react'
import { Card, Spinner, EmptyState } from '@/components/ui/primitives'
import { Plus, X } from 'lucide-react'
import { SkillLevel } from '@hr-system/types'
import { useSkills, useCreateSkill, useDeleteSkill } from '@/lib/api/hooks/useEmployeeProfile'

const LEVEL_LABEL: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
}

export function SkillsSection({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const { data: items = [], isLoading } = useSkills(employeeId)
  const create = useCreateSkill(employeeId)
  const remove = useDeleteSkill(employeeId)

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [level, setLevel] = useState<SkillLevel>(SkillLevel.INTERMEDIATE)
  const [years, setYears] = useState('')
  const [error, setError] = useState('')

  async function save() {
    if (!name.trim()) return
    setError('')
    try {
      await create.mutateAsync({
        name: name.trim(),
        level,
        yearsOfExperience: years ? Number(years) : undefined,
      })
      setName('')
      setYears('')
      setAdding(false)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to add skill')
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Skills ({items.length})</h3>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="Skill name…"
              className="h-8 flex-1 rounded border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={level}
              onChange={e => setLevel(e.target.value as SkillLevel)}
              className="h-8 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {Object.values(SkillLevel).map(l => (
                <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={years}
              onChange={e => setYears(e.target.value)}
              placeholder="Yrs"
              className="h-8 w-16 rounded border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={save}
              disabled={create.isPending || !name.trim()}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {create.isPending ? 'Saving…' : 'Add'}
            </button>
            <button onClick={() => { setAdding(false); setError('') }} className="rounded p-1.5 text-muted-foreground hover:bg-muted">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : items.length === 0 && !adding ? (
        <EmptyState message="No skills added yet." />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map(s => (
            <span
              key={s.id}
              className="group flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs"
            >
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">· {LEVEL_LABEL[s.level] ?? s.level}</span>
              {s.yearsOfExperience != null && <span className="text-muted-foreground">· {s.yearsOfExperience}y</span>}
              {canEdit && (
                <button
                  onClick={() => remove.mutate(s.id)}
                  className="ml-0.5 hidden rounded p-0.5 text-muted-foreground hover:text-destructive group-hover:inline-flex"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
