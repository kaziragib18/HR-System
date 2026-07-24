import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div>
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/peoplegrid-icon.svg" alt="" className="h-9 w-9" />
        <span className="text-lg font-semibold">PeopleGrid</span>
      </div>

      <div className="rounded-2xl border bg-card p-8 shadow-xl shadow-black/[0.03]">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your PeopleGrid account</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
