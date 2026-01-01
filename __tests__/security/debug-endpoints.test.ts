/**
 * Security tests for debug endpoints
 * Ensures debug endpoints are disabled in production
 */

import { NextRequest } from 'next/server'
import { GET as debugAuthGet } from '@/app/api/debug-auth-production/route'
import { GET as authTestGet } from '@/app/api/auth-test/route'

describe('Debug Endpoints Security', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  describe('debug-auth-production endpoint', () => {
    it('should return 404 in production', async () => {
      process.env.NODE_ENV = 'production'
      
      const request = new NextRequest('http://localhost:3000/api/debug-auth-production')
      const response = await debugAuthGet(request)
      
      expect(response.status).toBe(404)
      const text = await response.text()
      expect(text).toBe('Not Found')
    })

    it('should work in development', async () => {
      process.env.NODE_ENV = 'development'
      
      const request = new NextRequest('http://localhost:3000/api/debug-auth-production')
      const response = await debugAuthGet(request)
      
      // Should not return 404 (will return error due to missing auth, but that's expected)
      expect(response.status).not.toBe(404)
    })
  })

  describe('auth-test endpoint', () => {
    it('should return 404 in production', async () => {
      process.env.NODE_ENV = 'production'
      
      const request = new NextRequest('http://localhost:3000/api/auth-test')
      const response = await authTestGet(request)
      
      expect(response.status).toBe(404)
      const text = await response.text()
      expect(text).toBe('Not Found')
    })

    it('should work in development', async () => {
      process.env.NODE_ENV = 'development'
      
      const request = new NextRequest('http://localhost:3000/api/auth-test')
      const response = await authTestGet(request)
      
      // Should not return 404 (will return error due to missing auth, but that's expected)
      expect(response.status).not.toBe(404)
    })
  })
})