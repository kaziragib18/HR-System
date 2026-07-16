'use client'

import { useTheme } from '@/components/theme/theme-provider'
import { isDarkVariant } from '@/lib/theme'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme()

  if (!mounted) {
    return <div className="h-9 w-9" />
  }

  const isDark = isDarkVariant(theme)
  return (
    <button
      onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })}
      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  )
}
