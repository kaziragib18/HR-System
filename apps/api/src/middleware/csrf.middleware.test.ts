import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { requireCsrfToken } from './csrf.middleware'

function mockReq(cookies: Record<string, string>, headers: Record<string, string> = {}): Request {
  return { cookies, headers } as unknown as Request
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

describe('requireCsrfToken', () => {
  it('lets the request through when no csrf cookie exists yet (pre-migration session)', () => {
    const next = vi.fn()
    requireCsrfToken(mockReq({}), mockRes(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('allows the request when the header matches the cookie', () => {
    const next = vi.fn()
    requireCsrfToken(mockReq({ csrfToken: 'abc123' }, { 'x-csrf-token': 'abc123' }), mockRes(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('rejects when the cookie exists but the header is missing', () => {
    const next = vi.fn()
    const res = mockRes()
    requireCsrfToken(mockReq({ csrfToken: 'abc123' }), res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('rejects when the header does not match the cookie', () => {
    const next = vi.fn()
    const res = mockRes()
    requireCsrfToken(mockReq({ csrfToken: 'abc123' }, { 'x-csrf-token': 'wrong' }), res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
