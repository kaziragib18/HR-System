'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { applyTheme, isTheme, THEME_STORAGE_KEY, type Theme } from '@/lib/theme'
import { useAuthStore } from '@/store/auth.store'
import { apiClient } from '@/lib/api/client'

export interface ThemeOrigin {
  x: number
  y: number
}

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme, origin?: ThemeOrigin) => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)
  const userTheme = useAuthStore((s) => s.user?.theme)

  // Local fallback (unauthenticated pages, or before the session bootstraps).
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    const initial = stored && isTheme(stored) ? stored : 'light'
    setThemeState(initial)
    applyTheme(initial)
    setMounted(true)
  }, [])

  // Once the account's saved preference is known, it wins over whatever was on this browser.
  useEffect(() => {
    if (userTheme && isTheme(userTheme) && userTheme !== theme) {
      setThemeState(userTheme)
      localStorage.setItem(THEME_STORAGE_KEY, userTheme)
      applyTheme(userTheme)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTheme])

  function setTheme(next: Theme, origin?: ThemeOrigin) {
    function commit() {
      setThemeState(next)
      localStorage.setItem(THEME_STORAGE_KEY, next)
      applyTheme(next)

      const { user, updateUser } = useAuthStore.getState()
      if (user) {
        updateUser({ theme: next })
        apiClient.patch('/auth/theme', { theme: next }).catch(() => {})
      }
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!origin || prefersReducedMotion || !document.startViewTransition) {
      commit()
      return
    }

    const { x, y } = origin
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

    const transition = document.startViewTransition(commit)

    // Safety net: some browsers support startViewTransition but not animating a
    // pseudo-element directly (Element.animate's `pseudoElement` option landed
    // later than startViewTransition itself). If that combination isn't
    // supported, animate() throws and the transition's overlay would otherwise
    // sit on top of the whole page — silently swallowing every click (including
    // native <input type="date"> picker icons) until reload. Force it closed
    // instead, and never leave it open longer than a second regardless of cause.
    const fallback = setTimeout(() => transition.skipTransition(), 1000)

    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
          { duration: 650, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
        )
      })
      .catch(() => transition.skipTransition())

    transition.finished.catch(() => {}).finally(() => clearTimeout(fallback))
  }

  return <ThemeContext.Provider value={{ theme, setTheme, mounted }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
