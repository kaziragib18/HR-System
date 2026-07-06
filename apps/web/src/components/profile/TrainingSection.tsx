'use client'

import { useState } from 'react'
import { Card, Spinner, EmptyState, StatusBadge } from '@/components/ui/primitives'
import { Input } from '@/components/ui/section-card'
import { AttachedFileRow, FileInputButton } from '@/components/ui/file-attachment'
import { formatDate } from '@hr-system/utils'
import { Award, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import {
  useCertifications,
  useCreateCertification,
  useUpdateCertification,
  useDeleteCertification,
  useDocumentDownloadUrl,
} from '@/lib/api/hooks/useEmployeeProfile'
import type { Certification } from '@hr-system/types'

interface FormState {
  name: string
  issuingOrganization: string
  issueDate: string
  expiryDate: string
  credentialId: string
  credentialUrl: string
}

const BLANK: FormState = { name: '', issuingOrganization: '', issueDate: '', expiryDate: '', credentialId: '', credentialUrl: '' }

function toForm(c: Certification): FormState {
  return {
    name: c.name,
    issuingOrganization: c.issuingOrganization,
    issueDate: c.issueDate.slice(0, 10),
    expiryDate: c.expiryDate ? c.expiryDate.slice(0, 10) : '',
    credentialId: c.credentialId ?? '',
    credentialUrl: c.credentialUrl ?? '',
  }
}

function expiryBadge(expiryDate?: string | null) {
  if (!expiryDate) return null
  const days = (new Date(expiryDate).getTime() - Date.now()) / 86_400_000
  if (days < 0) return <StatusBadge status="TERMINATED" label="Expired" />
  if (days < 60) return <StatusBadge status="PROBATION" label="Expiring soon" />
  return null
}

export function TrainingSection({ employeeId, canEdit }: { employeeId: string; canEdit: boolean }) {
  const { data: items = [], isLoading } = useCertifications(employeeId)
  const create = useCreateCertification(employeeId)
  const update = useUpdateCertification(employeeId)
  const remove = useDeleteCertification(employeeId)
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

  function startEdit(c: Certification) {
    setEditingId(c.id)
    setForm(toForm(c))
    setFile(null)
    setShowForm(true)
    setError('')
  }

  async function save() {
    if (!form.name.trim() || !form.issuingOrganization.trim() || !form.issueDate) return
    setError('')
    const payload = {
      name: form.name.trim(),
      issuingOrganization: form.issuingOrganization.trim(),
      issueDate: form.issueDate,
      expiryDate: form.expiryDate || undefined,
      credentialId: form.credentialId.trim() || undefined,
      credentialUrl: form.credentialUrl.trim() || undefined,
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

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Training & Certifications ({items.length})</h3>
        {canEdit && !showForm && (
          <button onClick={startAdd} className="flex items-center gap-1 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        )}
      </div>

      {showForm ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" value={form.name} onChange={v => setForm(s => ({ ...s, name: v }))} />
            <Input label="Issuing organization" value={form.issuingOrganization} onChange={v => setForm(s => ({ ...s, issuingOrganization: v }))} />
            <Input label="Issue date" type="date" value={form.issueDate} onChange={v => setForm(s => ({ ...s, issueDate: v }))} />
            <Input label="Expiry date" type="date" value={form.expiryDate} onChange={v => setForm(s => ({ ...s, expiryDate: v }))} />
            <Input label="Credential ID" value={form.credentialId} onChange={v => setForm(s => ({ ...s, credentialId: v }))} />
            <Input label="Credential URL" value={form.credentialUrl} onChange={v => setForm(s => ({ ...s, credentialUrl: v }))} />
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Certificate file</p>
            {file ? (
              <AttachedFileRow fileName={file.name} fileSize={file.size} onDownload={() => {}} onRemove={() => setFile(null)} />
            ) : (
              <FileInputButton label="Attach certificate" accept=".pdf,.png,.jpg,.jpeg" onChange={setFile} />
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving || !form.name.trim() || !form.issuingOrganization.trim() || !form.issueDate}
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
        <EmptyState message="No training or certifications added yet." />
      ) : (
        <ul className="divide-y">
          {items.map(c => (
            <li key={c.id} className="group py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Award className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{c.name} · {c.issuingOrganization}</p>
                    {expiryBadge(c.expiryDate)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Issued {formatDate(c.issueDate)}{c.expiryDate ? ` · Expires ${formatDate(c.expiryDate)}` : ''}
                  </p>
                  {c.document && (
                    <div className="mt-2 max-w-sm">
                      <AttachedFileRow
                        fileName={c.document.name}
                        fileSize={c.document.fileSizeBytes}
                        onDownload={() => handleDownload(c.document!.id)}
                      />
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => startEdit(c)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {confirmDeleteId === c.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { remove.mutate(c.id); setConfirmDeleteId(null) }}
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
                        onClick={() => setConfirmDeleteId(c.id)}
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
