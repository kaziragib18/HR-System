'use client'

import { useMarkPaidPayrollRun, type PayrollRun } from '@/lib/api/hooks/usePayroll'
import { SubmitOverlay } from '@/components/ui/primitives'
import { Banknote, Loader2 } from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export function MarkPaidModal({ run, onClose }: { run: PayrollRun; onClose: () => void }) {
  const markPaid = useMarkPaidPayrollRun()

  async function handleConfirm() {
    await markPaid.mutateAsync(run.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !markPaid.isPending && onClose()}
    >
      <div
        className="relative w-full max-w-sm rounded-xl border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <SubmitOverlay show={markPaid.isPending} label="Marking as paid…" />
        <div className="p-4">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Banknote className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Mark payroll as paid?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{MONTHS[run.month - 1]} {run.year}</span> for {run.office.name}
                will be marked paid and every employee on this run will be notified. This can&apos;t be undone.
              </p>
            </div>
          </div>
          {markPaid.isError && (
            <p className="mb-2 text-xs text-destructive">
              {(markPaid.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to mark payroll as paid'}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={markPaid.isPending}
              className="flex-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={markPaid.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {markPaid.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {markPaid.isPending ? 'Marking…' : 'Mark Paid'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
