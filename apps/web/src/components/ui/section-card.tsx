'use client'

import { Card } from '@/components/ui/primitives'
import { Pencil, X, Check } from 'lucide-react'

// ─── Read-only field ──────────────────────────────────────────────────────────

export function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value || '—'}</p>
    </div>
  )
}

// ─── Editable section wrapper ─────────────────────────────────────────────────

export function SectionCard({
  title,
  editing,
  canEdit,
  saving,
  onEdit,
  onSave,
  onCancel,
  children,
}: {
  title: string
  editing: boolean
  canEdit: boolean
  saving: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        {canEdit && !editing && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-1">
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Save
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      {children}
    </Card>
  )
}

// ─── Form input helpers ───────────────────────────────────────────────────────

export function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-0.5 h-8 w-full rounded border bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  )
}

export function Textarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-0.5 w-full resize-none rounded border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  )
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder = '— Select —',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-0.5 h-8 w-full rounded border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
