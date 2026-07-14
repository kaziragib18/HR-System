'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { useEffect, useState } from 'react'

const NATIVE_PICKER_TYPES = new Set(['date', 'time', 'datetime-local', 'month', 'week'])

/**
 * Native <input type="date/time"> only opens its picker when you click the
 * tiny calendar/clock icon. Delegate clicks anywhere in the field to
 * showPicker() so the whole field is clickable, not just that small target.
 */
function useOpenPickerOnClick() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (
        target instanceof HTMLInputElement &&
        NATIVE_PICKER_TYPES.has(target.type) &&
        !target.disabled &&
        !target.readOnly
      ) {
        try {
          target.showPicker?.()
        } catch {
          // showPicker() can throw (e.g. not a user-activation context in some
          // browsers) — the native icon click still works as a fallback.
        }
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  )

  useOpenPickerOnClick()

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
