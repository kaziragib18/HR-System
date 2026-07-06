import Link from 'next/link'

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm">
      <div className="mb-2 text-center">
        <h1 className="text-2xl font-semibold">Forgot your password?</h1>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        This system has no automated email delivery yet. Contact HR and they can generate a
        password reset link for your account from your employee profile.
      </p>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
