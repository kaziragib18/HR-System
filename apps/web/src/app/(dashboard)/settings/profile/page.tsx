'use client'

import { useAuthStore } from '@/store/auth.store'
import { Card, Avatar } from '@/components/ui/primitives'

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value || '—'}</p>
    </div>
  )
}

export default function ProfileSettingsPage() {
  const { user } = useAuthStore()
  if (!user) return null

  return (
    <Card className="max-w-2xl">
      <div className="flex items-center gap-4">
        <Avatar firstName={user.firstName} lastName={user.lastName} url={user.avatarUrl} size={56} />
        <div>
          <h2 className="text-lg font-semibold">
            {user.firstName} {user.lastName}
          </h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <Field label="Role" value={user.role.replace(/_/g, ' ')} />
        <Field label="Office" value={user.officeCode} />
        <Field label="Employee ID" value={user.employeeId} />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Editing your own profile details (phone, address, emergency contact) arrives with the
        employee self-service portal in Phase 2.
      </p>
    </Card>
  )
}
