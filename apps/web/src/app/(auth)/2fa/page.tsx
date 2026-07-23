import { Suspense } from 'react'
import { TwoFactorForm } from '@/components/auth/TwoFactorForm'

export default function TwoFactorPage() {
  return (
    <div className="rounded-2xl border bg-card p-8 shadow-xl shadow-black/[0.03]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Two-factor authentication</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Verify your identity to continue</p>
      </div>
      <Suspense fallback={null}>
        <TwoFactorForm />
      </Suspense>
    </div>
  )
}
