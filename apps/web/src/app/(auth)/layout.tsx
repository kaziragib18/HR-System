import Link from 'next/link'
import { CalendarCheck, Users, Wallet } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: Users, text: 'Employees, departments & org structure' },
  { icon: CalendarCheck, text: 'Attendance & leave, approved in one click' },
  { icon: Wallet, text: 'Payroll for every office, done right' },
]

// Each feature bullet's icon chip cycles through the logo's four accent
// colors (amber/red/teal — navy is the panel's own background, so it isn't
// reused here) rather than a flat white chip, as a subtle callback to the
// four-color grid mark.
const CHIP_COLORS = ['bg-[#E8A23A]/20 text-[#E8A23A]', 'bg-[#C1443A]/20 text-[#C1443A]', 'bg-[#3C7A96]/25 text-[#7FB8D6]']

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-theme-lock flex min-h-screen bg-background text-foreground">
      {/* Brand panel — hidden below lg, where the page content carries its own compact brand mark instead.
          Gradient + accent colors are pulled straight from the logo mark (navy -> teal base, amber/red blob accents)
          rather than the app's generic blue --primary, so the login screen reads as a distinct brand moment. */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1B2432] via-[#223349] to-[#3C7A96] p-10 text-white lg:flex xl:p-14">
        <div className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-[#E8A23A]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 -right-20 h-96 w-96 rounded-full bg-[#C1443A]/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <Link href="/login" className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 p-1.5 backdrop-blur-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/peoplegrid-icon.svg" alt="" className="h-full w-full" />
          </span>
          <span className="text-lg font-semibold">PeopleGrid</span>
        </Link>

        <div className="relative max-w-sm space-y-6">
          <h2 className="text-3xl font-semibold leading-tight text-balance">
            Everything HR, in one place.
          </h2>
          <ul className="space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }, i) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/85">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${CHIP_COLORS[i % CHIP_COLORS.length]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          © {new Date().getFullYear()} PeopleGrid
        </p>
      </div>

      {/* Page content */}
      <div className="flex w-full flex-1 items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
