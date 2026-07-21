import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../client'

export interface Holiday {
  id: string
  officeId: string
  name: string
  date: string
  year: number
  isRecurring: boolean
  office: { code: string; name: string }
}

export function useHolidays(year: number) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: async () => {
      const { data } = await apiClient.get('/holidays', { params: { year } })
      return data.data as Holiday[]
    },
  })
}

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { officeId: string; name: string; date: string; isRecurring?: boolean }) => {
      const { data } = await apiClient.post('/holidays', payload)
      return data.data as Holiday
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  })
}

export function useUpdateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string
      officeId?: string
      name?: string
      date?: string
      isRecurring?: boolean
    }) => {
      const { data } = await apiClient.patch(`/holidays/${id}`, payload)
      return data.data as Holiday
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/holidays/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  })
}
