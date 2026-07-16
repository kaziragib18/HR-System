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
}

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAnnouncementPayload) => {
      // Plain JSON — announcements no longer support attachments, so there's no
      // file to send. The backend's multer middleware simply no-ops on a
      // non-multipart request and express.json() parses the body.
      const { data } = await apiClient.post('/announcements', payload)
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
    }: {
      id: string
      title?: string
      body?: string
      category?: AnnouncementCategory
      expiresAt?: string | null
      officeId?: string | null
    }) => {
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
