'use client'

import { useAuthStore } from '@/store/auth.store'

export default function DashboardPage() {
  const { user } = useAuthStore()

  return (
    <div>
      <h1 className="text-2xl font-semibold">
        Welcome back{user ? `, ${user.firstName}` : ''}
      </h1>
      <p className="mt-1 text-muted-foreground">
        {user ? `${user.role.replace('_', ' ')} · ${user.officeCode} office` : ''}
      </p>

      <div className="mt-6 rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Dashboard widgets (headcount, attendance, leave) arrive in Phase 1 Week 4.
        </p>
      </div>
    </div>
  )
}
