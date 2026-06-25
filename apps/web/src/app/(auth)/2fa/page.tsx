import { Suspense } from 'react'
import { TwoFactorForm } from '@/components/auth/TwoFactorForm'

export default function TwoFactorPage() {
  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold">Two-factor authentication</h1>
        <p className="mt-1 text-sm text-muted-foreground">Verify your identity to continue</p>
      </div>
      <Suspense fallback={null}>
        <TwoFactorForm />
      </Suspense>
    </div>
  )
}
