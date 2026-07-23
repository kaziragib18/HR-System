import Link from 'next/link'
import { CalendarCheck, Users, Wallet } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: Users, text: 'Employees, departments & org structure' },
  { icon: CalendarCheck, text: 'Attendance & leave, approved in one click' },
  { icon: Wallet, text: 'Payroll for every office, done right' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-theme-lock flex min-h-screen bg-background text-foreground">
      {/* Brand panel — hidden below lg, where the page content carries its own compact brand mark instead */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-indigo-700 p-10 text-primary-foreground lg:flex xl:p-14">
        <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--primary-foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary-foreground)) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <Link href="/login" className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-sm font-bold backdrop-blur-sm">
            HR
          </span>
          <span className="text-lg font-semibold">HR System</span>
        </Link>

        <div className="relative max-w-sm space-y-6">
          <h2 className="text-3xl font-semibold leading-tight text-balance">
            Everything HR, in one place.
          </h2>
          <ul className="space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-primary-foreground/85">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} HR System
        </p>
      </div>

      {/* Page content */}
      <div className="flex w-full flex-1 items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
