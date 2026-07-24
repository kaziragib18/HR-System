import type { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response'

export const CSRF_COOKIE = 'csrfToken'
const CSRF_HEADER = 'x-csrf-token'

/**
 * Double-submit CSRF check for state-changing routes that authenticate purely
 * via an httpOnly cookie (refresh/logout — there's no bearer access token to
 * prove the request came from the real frontend). A cross-site request can
 * make the browser attach cookies automatically, but it can't *read* this
 * cookie's value to echo it back as a header — only same-origin JS can, since
 * browsers block cross-origin `document.cookie` reads. See
 * auth.controller.ts's setCsrfCookie for where this cookie gets (re)issued.
 *
 * If the cookie is missing entirely, the request is let through rather than
 * rejected: this cookie only started being issued alongside this check, so
 * any session created before this shipped won't have one yet. Rejecting
 * those outright would force every already-logged-in user to re-authenticate
 * the moment this deploys. Letting it through here means the *next* response
 * mints one (see auth.controller.ts), so the session is protected from then
 * on — a forged cross-site request gains nothing extra during this narrow
 * window either, since it can't read the response body (CORS) and, for
 * `/refresh`, the token it'd receive is useless without also holding the
 * refresh cookie it doesn't have.
 */
export function requireCsrfToken(req: Request, res: Response, next: NextFunction): void {
  const cookieValue = req.cookies?.[CSRF_COOKIE]
  if (!cookieValue) {
    next()
    return
  }
  const headerValue = req.headers[CSRF_HEADER]
  if (headerValue !== cookieValue) {
    sendError(res, 'Missing or invalid CSRF token', 403)
    return
  }
  next()
}
