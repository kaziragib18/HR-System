'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'
import type { AnnouncementFeedItem, AnnouncementCategory } from '@hr-system/types'

export function useAnnouncementFeed() {
  return useQuery({
    queryKey: ['announcements', 'feed'],
    queryFn: async () => {
      const { data } = await apiClient.get('/announcements/feed')
      return data.data as AnnouncementFeedItem[]
    },
  })
}

export interface CreateAnnouncementPayload {
  title: string
  body: string
  category: AnnouncementCategory
  officeId?: string
  expiresAt?: string
  attachment?: File
}

function toFormData(payload: CreateAnnouncementPayload): FormData {
  const form = new FormData()
  form.append('title', payload.title)
  form.append('body', payload.body)
  form.append('category', payload.category)
  if (payload.officeId) form.append('officeId', payload.officeId)
  if (payload.expiresAt) form.append('expiresAt', payload.expiresAt)
  if (payload.attachment) form.append('attachment', payload.attachment)
  return form
}

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAnnouncementPayload) => {
      const { data } = await apiClient.post('/announcements', toFormData(payload), {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string; title?: string; body?: string; category?: AnnouncementCategory; expiresAt?: string | null }) => {
      const { data } = await apiClient.patch(`/announcements/${id}`, payload)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/announcements/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  })
}
