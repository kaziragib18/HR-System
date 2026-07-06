'use client'

import { useState } from 'react'
import { Card, Spinner, EmptyState } from '@/components/ui/primitives'
import { Input, Select } from '@/components/ui/section-card'
import { AttachedFileRow, FileInputButton } from '@/components/ui/file-attachment'
import { formatDate } from '@hr-system/utils'
import { CreditCard, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { IdentificationType } from '@hr-system/types'
import {
  useIdentifications,
  useCreateIdentification,
  useUpdateIdentification,
  useDeleteIdentification,
  useDocumentDownloadUrl,
} from '@/lib/api/hooks/useEmployeeProfile'
import type { Identification } from '@hr-system/types'

const TYPE_LABEL: Record<string, string> = {
  NATIONAL_ID: 'National ID',
  PASSPORT: 'Passport',
  DRIVING_LICENSE: 'Driving License',
  OTHER: 'Other',
}

interface FormState {
  type: IdentificationType
  documentNumber: string
  issuingAuthority: string
  issueDate: string
  expiryDate: string
}

const BLANK: FormState = { type: IdentificationType.NATIONAL_ID, documentNumber: '', issuingAuthority: '', issueDate: '', expiryDate: '' }

function toForm(i: Identification): FormState {
  return {
    type: i.type,
    documentNumber: i.documentNumber,
    issuingAuthority: i.issuingAuthority ?? '',
    issueDate: i.issueDate ? i.issueDate.slice(0, 10) : '',
    expiryDate: i.expiryDate ? i.expiryDate.slice(0, 10) : '',
  }
}

export function IdentificationSection({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const { data: items = [], isLoading } = useIdentifications(employeeId)
  const create = useCreateIdentification(employeeId)
  const update = useUpdateIdentification(employeeId)
  const remove = useDeleteIdentification(employeeId)
  const downloadUrl = useDocumentDownloadUrl()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [file, setFile] = useState<File | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [error, setError] = useState('')

  function startAdd() {
    setEditingId(null)
    setForm(BLANK)
    setFile(null)
    setShowForm(true)
    setError('')
  }

  function startEdit(i: Identification) {
    setEditingId(i.id)
    setForm(toForm(i))
    setFile(null)
    setShowForm(true)
    setError('')
  }

  async function save() {
    if (!form.documentNumber.trim()) return
    setError('')
    const payload = {
      type: form.type,
      documentNumber: form.documentNumber.trim(),
      issuingAuthority: form.issuingAuthority.trim() || undefined,
      issueDate: form.issueDate || undefined,
      expiryDate: form.expiryDate || undefined,
    }
    try {
      if (editingId) await update.mutateAsync({ id: editingId, file: file ?? undefined, ...payload })
      else await create.mutateAsync({ file: file ?? undefined, ...payload })
      setShowForm(false)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save')
    }
  }

  async function handleDownload(documentId: string) {
    const result = await downloadUrl.mutateAsync(documentId)
    window.open(result.downloadUrl, '_blank')
  }

  const saving = create.isPending || update.isPending
  const typeOptions = Object.values(IdentificationType).map(t => ({ value: t, label: TYPE_LABEL[t] ?? t }))

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Identification ({items.length})</h3>
        {canEdit && !showForm && (
          <button onClick={startAdd} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>

      {showForm ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.type} onChange={v => setForm(s => ({ ...s, type: v as IdentificationType }))} options={typeOptions} />
            <Input label="Document number" value={form.documentNumber} onChange={v => setForm(s => ({ ...s, documentNumber: v }))} />
            <Input label="Issuing authority" value={form.issuingAuthority} onChange={v => setForm(s => ({ ...s, issuingAuthority: v }))} />
            <Input label="Issue date" type="date" value={form.issueDate} onChange={v => setForm(s => ({ ...s, issueDate: v }))} />
            <Input label="Expiry date" type="date" value={form.expiryDate} onChange={v => setForm(s => ({ ...s, expiryDate: v }))} />
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Scanned document</p>
            {file ? (
              <AttachedFileRow fileName={file.name} fileSize={file.size} onDownload={() => {}} onRemove={() => setFile(null)} />
            ) : (
              <FileInputButton label="Attach scan" accept=".pdf,.png,.jpg,.jpeg" onChange={setFile} />
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving || !form.documentNumber.trim()}
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
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState message="No identification records added yet." />
      ) : (
        <ul className="divide-y">
          {items.map(i => (
            <li key={i.id} className="group py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{TYPE_LABEL[i.type] ?? i.type} · {i.documentNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.issuingAuthority ? `${i.issuingAuthority} · ` : ''}
                    {i.expiryDate ? `Expires ${formatDate(i.expiryDate)}` : 'No expiry on file'}
                  </p>
                  {i.document && (
                    <div className="mt-2 max-w-sm">
                      <AttachedFileRow
                        fileName={i.document.name}
                        fileSize={i.document.fileSizeBytes}
                        onDownload={() => handleDownload(i.document!.id)}
                      />
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => startEdit(i)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {confirmDeleteId === i.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { remove.mutate(i.id); setConfirmDeleteId(null) }}
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
                        onClick={() => setConfirmDeleteId(i.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
