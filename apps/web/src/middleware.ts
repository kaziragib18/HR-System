import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/2fa']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for access token in Authorization header (won't be present in middleware)
  // We rely on the refresh token cookie to determine if session may be valid.
  // The actual token validation happens on the API. Here we just check cookie presence.
  const refreshTokenCookie = request.cookies.get('refreshToken')

  if (!refreshTokenCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|forgot-password|reset-password|2fa).*)',
  ],
}
