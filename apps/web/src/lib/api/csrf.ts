// Reads the (non-httpOnly) csrfToken cookie the API sets on login/2FA-verify
// and on every successful /auth/refresh — see the API's csrf.middleware.ts
// for the double-submit check this pairs with. Only same-origin JS can read
// this value, which is exactly what makes echoing it back as a header prove
// the request came from the real frontend, not a cross-site forgery.
export function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : undefined
}
