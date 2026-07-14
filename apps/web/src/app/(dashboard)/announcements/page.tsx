'use client'

import { useState } from 'react'
import { PageHeader, Card, Spinner, EmptyState } from '@/components/ui/primitives'
import { AnnouncementRow } from '@/components/dashboard/AnnouncementsCard'
import {
  useAnnouncementFeed,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from '@/lib/api/hooks/useAnnouncements'
import { useOffices } from '@/lib/api/hooks/useReference'
import { useAuthStore } from '@/store/auth.store'
import { AnnouncementCategory, MANUAL_ANNOUNCEMENT_CATEGORIES, UserRole } from '@hr-system/types'
import type { AnnouncementFeedItem } from '@hr-system/types'
import { Plus, X, Pencil, Trash2, AlertCircle } from 'lucide-react'

function fmtCategory(c: string) {
  return c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function CreateAnnouncementModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const { data: offices = [] } = useOffices()
  const create = useCreateAnnouncement()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<AnnouncementCategory>(AnnouncementCategory.GENERAL)
  const [officeId, setOfficeId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [error, setError] = useState('')

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN

  async function handleSubmit() {
    setError('')
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required')
      return
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        body: body.trim(),
        category,
        officeId: isSuperAdmin && officeId ? officeId : undefined,
        expiresAt: expiresAt || undefined,
        attachment: attachment ?? undefined,
      })
      onClose()
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(message ?? 'Failed to post announcement')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-medium">New Announcement</p>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {MANUAL_ANNOUNCEMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{fmtCategory(c)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Expires (optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          {isSuperAdmin && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Office</label>
              <select
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Offices</option>
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>{o.code}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Attachment (optional)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-xs"
            />
          </div>
        </div>
        <div className="flex gap-2 border-t px-4 py-3">
          <button onClick={onClose} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={create.isPending}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

function canManage(item: AnnouncementFeedItem, userEmployeeId?: string, isSuperAdmin?: boolean): boolean {
  return item.source === 'MANUAL' && (isSuperAdmin || item.authorId === userEmployeeId)
}

export default function AnnouncementsPage() {
  const user = useAuthStore((s) => s.user)
  const { data: items = [], isLoading } = useAnnouncementFeed()
  const deleteAnnouncement = useDeleteAnnouncement()
  const updateAnnouncement = useUpdateAnnouncement()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<AnnouncementFeedItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN
  const canPost = !!user && [UserRole.SUPER_ADMIN, UserRole.HR_MANAGER].includes(user.role as UserRole)

  function startEdit(item: AnnouncementFeedItem) {
    setEditing(item)
    setEditTitle(item.title)
    setEditBody(item.body)
  }

  async function saveEdit() {
    if (!editing) return
    await updateAnnouncement.mutateAsync({ id: editing.id, title: editTitle, body: editBody })
    setEditing(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement?')) return
    await deleteAnnouncement.mutateAsync(id)
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Company news, closures, and automatic updates."
        action={
          canPost && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Announcement
            </button>
          )
        }
      />

      <Card>
        {isLoading ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState message="No announcements yet." />
        ) : (
          <div>
            {items.map((item) => (
              <div key={item.id} className="group flex items-start gap-2">
                <div className="flex-1">
                  <AnnouncementRow item={item} />
                </div>
                {canManage(item, user?.employeeId, isSuperAdmin) && (
                  <div className="flex shrink-0 gap-1 pt-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => startEdit(item)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {showCreate && <CreateAnnouncementModal onClose={() => setShowCreate(false)} />}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-medium">Edit Announcement</p>
              <button onClick={() => setEditing(null)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Body</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-2 border-t px-4 py-3">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={updateAnnouncement.isPending}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {updateAnnouncement.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
