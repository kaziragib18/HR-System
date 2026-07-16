'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { Card, Spinner } from '@/components/ui/primitives'
import { Building2, Check, Upload, Trash2, FileText, ExternalLink, ImagePlus } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Office {
  id: string
  code: string
  name: string
  country: string
  currency: string
  timezone: string
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  logoUrl?: string | null
}

interface ComplianceDoc {
  id: string
  title: string
  description?: string | null
  storagePath: string
  mimeType?: string | null
  fileSize?: number | null
  createdAt: string
  uploadedBy: { id: string; firstName: string; lastName: string }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useOffices() {
  return useQuery({
    queryKey: ['company-offices'],
    queryFn: async () => {
      const { data } = await apiClient.get('/company/offices')
      return data.data as Office[]
    },
  })
}

function useComplianceDocs() {
  return useQuery({
    queryKey: ['compliance-docs'],
    queryFn: async () => {
      const { data } = await apiClient.get('/company/compliance-docs')
      return data.data as ComplianceDoc[]
    },
  })
}

// ─── Office Info Form ─────────────────────────────────────────────────────────

function OfficeForm({ office }: { office: Office }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name:    office.name,
    address: office.address ?? '',
    phone:   office.phone ?? '',
    email:   office.email ?? '',
    website: office.website ?? '',
  })
  const [saved, setSaved] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(office.logoUrl ?? null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')

  const update = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { data } = await apiClient.patch(`/company/offices/${office.id}`, payload)
      return data.data as Office
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-offices'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError('')
    setLogoPreview(URL.createObjectURL(file))
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const { data } = await apiClient.post(`/company/offices/${office.id}/logo`, fd)
      setLogoPreview(data.data.logoUrl)
      qc.invalidateQueries({ queryKey: ['company-offices'] })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Logo upload failed'
      setLogoError(msg)
    } finally {
      setLogoUploading(false)
    }
  }

  const field = 'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
  const label = 'mb-1 block text-xs font-medium text-muted-foreground'

  return (
    <form
      onSubmit={e => { e.preventDefault(); update.mutate(form) }}
      className="space-y-4"
    >
      {/* Logo upload */}
      <div className="flex items-center gap-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
          {logoPreview ? (
            <Image src={logoPreview} alt="Company logo" fill className="object-contain p-1" unoptimized />
          ) : (
            <Building2 className="h-8 w-8 text-muted-foreground/40" />
          )}
          {logoUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Spinner />
            </div>
          )}
        </div>
        <div>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
            <ImagePlus className="h-4 w-4" />
            {logoUploading ? 'Uploading…' : 'Upload logo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={handleLogoChange}
              disabled={logoUploading}
            />
          </label>
          <p className="mt-1 text-[11px] text-muted-foreground">PNG, JPG, SVG or WebP · max 5 MB</p>
          {logoError && <p className="mt-1 text-[11px] text-destructive">{logoError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Office Name</label>
          <input className={field} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className={label}>Country / Currency</label>
          <input
            className={cn(field, 'bg-muted/40 text-muted-foreground')}
            value={`${office.country} · ${office.currency}`}
            readOnly
          />
        </div>
      </div>
      <div>
        <label className={label}>Address</label>
        <textarea
          className={cn(field, 'min-h-[72px] resize-none')}
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          placeholder="Full office address…"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Phone</label>
          <input className={field} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+880 2 xxxxxxxx" />
        </div>
        <div>
          <label className={label}>Email</label>
          <input type="email" className={field} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="office@company.com" />
        </div>
      </div>
      <div>
        <label className={label}>Website</label>
        <input className={field} value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://www.company.com" />
      </div>

      {update.isError && (
        <p className="text-xs text-destructive">
          {(update.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to save'}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={update.isPending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saved ? <><Check className="h-4 w-4" /> Saved</> : update.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

// ─── Compliance Docs Section ──────────────────────────────────────────────────

function ComplianceDocs() {
  const qc = useQueryClient()
  const { data: docs = [], isLoading } = useComplianceDocs()
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState('')

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/company/compliance-docs/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compliance-docs'] }),
  })

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !title.trim()) return
    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', title.trim())
      if (description.trim()) fd.append('description', description.trim())

      await apiClient.post('/company/compliance-docs', fd)
      qc.invalidateQueries({ queryKey: ['compliance-docs'] })
      setTitle('')
      setDescription('')
      setFile(null)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err as Error).message ??
        'Upload failed'
      setUploadError(msg)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(id: string) {
    const { data } = await apiClient.get(`/company/compliance-docs/${id}/download-url`)
    window.open(data.data.downloadUrl, '_blank')
  }

  function fmtSize(bytes?: number | null) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <Card>
        <p className="mb-3 text-sm font-medium">Upload Compliance Document</p>
        <form onSubmit={handleUpload} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Employee Handbook 2026"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Description (optional)</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description…"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">File</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted/80"
            />
          </div>
          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          <button
            type="submit"
            disabled={uploading || !file || !title.trim()}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload Document'}
          </button>
        </form>
      </Card>

      {/* Existing docs list */}
      <Card>
        <p className="mb-3 text-sm font-medium">Compliance Documents ({docs.length})</p>
        {isLoading ? (
          <Spinner />
        ) : docs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No compliance documents uploaded yet.</p>
        ) : (
          <div className="divide-y">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-start gap-3 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  {doc.description && (
                    <p className="text-xs text-muted-foreground truncate">{doc.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {doc.fileSize && ` · ${fmtSize(doc.fileSize)}`}
                    {` · by ${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleDownload(doc.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Download"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${doc.title}"?`)) deleteMut.mutate(doc.id)
                    }}
                    disabled={deleteMut.isPending}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function CompanyPanel() {
  const { data: offices, isLoading } = useOffices()
  const [activeOffice, setActiveOffice] = useState(0)

  if (isLoading) return <Spinner />

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Office info section */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Office Information</h2>
        </div>

        {offices && offices.length > 1 && (
          <div className="mb-4 flex gap-1">
            {offices.map((o, i) => (
              <button
                key={o.id}
                onClick={() => setActiveOffice(i)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  activeOffice === i
                    ? 'bg-primary text-primary-foreground'
                    : 'border hover:bg-muted'
                )}
              >
                {o.code} — {o.name}
              </button>
            ))}
          </div>
        )}

        {offices && offices[activeOffice] && (
          <Card>
            <OfficeForm key={offices[activeOffice].id} office={offices[activeOffice]} />
          </Card>
        )}
      </div>

      {/* Compliance documents */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Compliance Documents</h2>
          <p className="text-sm text-muted-foreground">Visible to all employees on their dashboard</p>
        </div>
        <ComplianceDocs />
      </div>
    </div>
  )
}
