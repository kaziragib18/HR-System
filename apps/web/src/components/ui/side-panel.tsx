'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Right-docked slide-out drawer. The app's reusable side panel — a backdrop +
 * a panel that slides in from the right, sitting above the (non-fixed, z-auto)
 * Sidebar/Topbar at z-50 like every other overlay. Closes on backdrop click,
 * the X button, or Escape. Body scrolls via the themed .scrollbar-thin utility.
 */
export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  widthClass = 'max-w-md',
  children,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  widthClass?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-card shadow-2xl',
              widthClass
            )}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{title}</div>
                {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
