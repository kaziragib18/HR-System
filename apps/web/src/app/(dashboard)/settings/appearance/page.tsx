'use client'

import { Card } from '@/components/ui/primitives'
import { useTheme } from '@/components/theme/theme-provider'
import { LIGHT_THEME_SWATCHES, DARK_THEME_SWATCHES, type Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'

function ThemeSwatch({
  id,
  label,
  gradient,
  selected,
  onSelect,
}: {
  id: Theme
  label: string
  gradient: string
  selected: boolean
  onSelect: (id: Theme, origin: { x: number; y: number }) => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={(e) => onSelect(id, { x: e.clientX, y: e.clientY })}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg p-2 transition-colors',
        selected ? 'ring-2 ring-primary' : 'hover:bg-muted'
      )}
    >
      <span
        className="h-12 w-16 rounded-md border shadow-sm"
        style={{ background: gradient }}
      />
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

export default function AppearanceSettingsPage() {
  const { theme, setTheme, mounted } = useTheme()

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm font-medium">Theme</p>
        <p className="mt-1 text-xs text-muted-foreground">Choose how the interface looks.</p>

        <div className="mt-4 flex flex-wrap gap-3">
          {LIGHT_THEME_SWATCHES.map(s => (
            <ThemeSwatch
              key={s.id}
              id={s.id}
              label={s.label}
              gradient={s.gradient}
              selected={mounted && theme === s.id}
              onSelect={setTheme}
            />
          ))}
        </div>

        <div className="my-5 flex items-center gap-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dark</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-wrap gap-3">
          {DARK_THEME_SWATCHES.map(s => (
            <ThemeSwatch
              key={s.id}
              id={s.id}
              label={s.label}
              gradient={s.gradient}
              selected={mounted && theme === s.id}
              onSelect={setTheme}
            />
          ))}
        </div>
      </Card>
    </div>
  )
}
