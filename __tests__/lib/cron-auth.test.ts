import { NextRequest } from 'next/server'
import { isVercelCronRequest, isAuthorizedCronRequest, getAuthMethod } from '@/lib/cron-auth'

// Mock NextRequest
function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name] || null
    }
  } as NextRequest
}

describe('Cron Authentication', () => {
  const testSecret = 'test-cron-secret'

  describe('isVercelCronRequest', () => {
    it('should return true for Vercel cron header', () => {
      const request = createMockRequest({ 'vercel-cron': 'vercel-cron' })
      expect(isVercelCronRequest(request)).toBe(true)
    })

    it('should return true for x-vercel-cron header', () => {
      const request = createMockRequest({ 'x-vercel-cron': 'x-vercel-cron' })
      expect(isVercelCronRequest(request)).toBe(true)
    })

    it('should return true for Vercel cron user-agent', () => {
      const request = createMockRequest({ 'user-agent': 'vercel-cron/1.0' })
      expect(isVercelCronRequest(request)).toBe(true)
    })

    it('should return false for regular requests', () => {
      const request = createMockRequest({ 'user-agent': 'Mozilla/5.0' })
      expect(isVercelCronRequest(request)).toBe(false)
    })
  })

  describe('isAuthorizedCronRequest', () => {
    it('should authorize Vercel cron requests', () => {
      const request = createMockRequest({ 'vercel-cron': 'vercel-cron' })
      expect(isAuthorizedCronRequest(request, testSecret)).toBe(true)
    })

    it('should authorize requests with valid Bearer token', () => {
      const request = createMockRequest({ 'authorization': `Bearer ${testSecret}` })
      expect(isAuthorizedCronRequest(request, testSecret)).toBe(true)
    })

    it('should reject requests with invalid Bearer token', () => {
      const request = createMockRequest({ 'authorization': 'Bearer wrong-secret' })
      expect(isAuthorizedCronRequest(request, testSecret)).toBe(false)
    })

    it('should reject unauthorized requests', () => {
      const request = createMockRequest({ 'user-agent': 'Mozilla/5.0' })
      expect(isAuthorizedCronRequest(request, testSecret)).toBe(false)
    })

    it('should work without cron secret', () => {
      const request = createMockRequest({ 'vercel-cron': 'vercel-cron' })
      expect(isAuthorizedCronRequest(request)).toBe(true)
    })
  })

  describe('getAuthMethod', () => {
    it('should return vercel-cron for Vercel cron requests', () => {
      const request = createMockRequest({ 'vercel-cron': 'vercel-cron' })
      expect(getAuthMethod(request, testSecret)).toBe('vercel-cron')
    })

    it('should return bearer-token for valid Bearer token', () => {
      const request = createMockRequest({ 'authorization': `Bearer ${testSecret}` })
      expect(getAuthMethod(request, testSecret)).toBe('bearer-token')
    })

    it('should return none for unauthorized requests', () => {
      const request = createMockRequest({ 'user-agent': 'Mozilla/5.0' })
      expect(getAuthMethod(request, testSecret)).toBe('none')
    })
  })
}) 