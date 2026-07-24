import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/2fa']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Soft gate: if there's no refresh-token cookie, redirect to login.
  // The real session validation happens client-side in AuthGuard (refresh + /me).
  const hasSession = request.cookies.get('refreshToken')
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Excludes API routes, Next internals, the public auth pages, and any
    // static asset (by file extension) — public/*.svg|png|ico etc. previously
    // fell through none of these exclusions except the one literal
    // "favicon.ico", so any other logo/image referenced on an unauthenticated
    // page (e.g. the login screen's own brand mark) got redirected to /login
    // instead of served, breaking the image.
    '/((?!api|_next/static|_next/image|login|forgot-password|reset-password|2fa|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
