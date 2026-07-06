'use client'

import { useState } from 'react'
import { KeyRound, Copy, X } from 'lucide-react'
import { useGeneratePasswordReset } from '@/lib/api/hooks/useEmployees'
import { Card } from '@/components/ui/primitives'

export function PasswordResetButton({ employeeId }: { employeeId: string }) {
  const generate = useGeneratePasswordReset()
  const [result, setResult] = useState<{ resetLink: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    setCopied(false)
    const res = await generate.mutateAsync(employeeId)
    setResult(res)
  }

  if (result) {
    return (
      <Card className="mt-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Password reset link generated</p>
            <p className="mt-1 text-xs text-muted-foreground">
              There's no email delivery in this system — copy this link and send it to the
              employee yourself. It expires at {new Date(result.expiresAt).toLocaleString()} and
              can only be used once.
            </p>
          </div>
          <button onClick={() => setResult(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs break-all">
          <span>{result.resetLink}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(result.resetLink); setCopied(true) }}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-primary"
          >
            <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </Card>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={generate.isPending}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
    >
      <KeyRound className="h-3.5 w-3.5" />
      {generate.isPending ? 'Generating…' : 'Reset password'}
    </button>
  )
}
