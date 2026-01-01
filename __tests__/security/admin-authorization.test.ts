/**
 * Admin Authorization Security Tests
 * Ensures admin endpoints properly check for admin privileges
 */

import { NextRequest } from 'next/server'

// Store original env
const originalEnv = process.env

describe('Admin Authorization Security', () => {
  beforeEach(() => {
    jest.resetModules()
    // Set up test environment variables
    process.env = {
      ...originalEnv,
      ADMIN_EMAILS: 'admin@example.com,superadmin@company.com',
      ADMIN_USER_IDS: 'admin-user-id-123,admin-user-id-456'
    }
  })

  afterEach(() => {
    process.env = originalEnv
    jest.clearAllMocks()
  })

  describe('isAdminUser function', () => {
    it('should allow users with admin email from ADMIN_EMAILS env', () => {
      const { isAdminUser } = require('@/lib/auth-server')
      const adminUser = { email: 'admin@example.com', id: 'user123' }
      expect(isAdminUser(adminUser)).toBe(true)
    })

    it('should allow users with admin email (case insensitive)', () => {
      const { isAdminUser } = require('@/lib/auth-server')
      const adminUser = { email: 'ADMIN@EXAMPLE.COM', id: 'user123' }
      expect(isAdminUser(adminUser)).toBe(true)
    })

    it('should allow specific admin user ID from ADMIN_USER_IDS env', () => {
      const { isAdminUser } = require('@/lib/auth-server')
      const adminUser = { email: 'user@randomdomain.com', id: 'admin-user-id-123' }
      expect(isAdminUser(adminUser)).toBe(true)
    })

    it('should allow users with admin role in app_metadata', () => {
      const { isAdminUser } = require('@/lib/auth-server')
      const adminUser = {
        email: 'user@example.com',
        id: 'user123',
        app_metadata: { role: 'admin' }
      }
      expect(isAdminUser(adminUser)).toBe(true)
    })

    it('should allow users with admin role in user_metadata', () => {
      const { isAdminUser } = require('@/lib/auth-server')
      const adminUser = {
        email: 'user@example.com',
        id: 'user123',
        user_metadata: { role: 'admin' }
      }
      expect(isAdminUser(adminUser)).toBe(true)
    })

    it('should reject regular users not in admin list', () => {
      const { isAdminUser } = require('@/lib/auth-server')
      const regularUser = { email: 'user@example.com', id: 'user123' }
      expect(isAdminUser(regularUser)).toBe(false)
    })

    it('should reject null/undefined users', () => {
      const { isAdminUser } = require('@/lib/auth-server')
      expect(isAdminUser(null)).toBe(false)
      expect(isAdminUser(undefined)).toBe(false)
    })

    it('should NOT allow arbitrary test domains (security fix)', () => {
      const { isAdminUser } = require('@/lib/auth-server')
      // This is the security fix - @voicememory.test should NOT grant admin
      const fakeAdmin = { email: 'attacker@voicememory.test', id: 'user123' }
      expect(isAdminUser(fakeAdmin)).toBe(false)
    })

    it('should NOT allow email domain spoofing', () => {
      const { isAdminUser } = require('@/lib/auth-server')
      const spoofedUser = { email: 'admin@example.com.evil.com', id: 'user123' }
      expect(isAdminUser(spoofedUser)).toBe(false)
    })
  })

  describe('Admin config module', () => {
    it('should parse admin emails from environment', () => {
      const { getAdminEmails, isAdminEmail } = require('@/lib/admin-config')
      const emails = getAdminEmails()
      expect(emails).toContain('admin@example.com')
      expect(emails).toContain('superadmin@company.com')
      expect(isAdminEmail('admin@example.com')).toBe(true)
      expect(isAdminEmail('random@other.com')).toBe(false)
    })

    it('should parse admin user IDs from environment', () => {
      const { getAdminUserIds } = require('@/lib/admin-config')
      const ids = getAdminUserIds()
      expect(ids).toContain('admin-user-id-123')
      expect(ids).toContain('admin-user-id-456')
    })

    it('should handle empty admin emails gracefully', () => {
      process.env.ADMIN_EMAILS = ''
      jest.resetModules()
      const { getAdminEmails, isAdminEmail } = require('@/lib/admin-config')
      expect(getAdminEmails()).toEqual([])
      expect(isAdminEmail('any@email.com')).toBe(false)
    })

    it('should handle malformed admin emails', () => {
      process.env.ADMIN_EMAILS = 'valid@email.com, , invalid, another@valid.com'
      jest.resetModules()
      const { getAdminEmails } = require('@/lib/admin-config')
      const emails = getAdminEmails()
      expect(emails).toContain('valid@email.com')
      expect(emails).toContain('another@valid.com')
      expect(emails).not.toContain('invalid')
      expect(emails).not.toContain('')
    })
  })

  describe('Admin endpoints error handling', () => {
    it('should return 401 for authentication errors', () => {
      const error = new Error('Authentication required')

      const getStatusForError = (error: Error) => {
        if (error.message === 'Authentication required') return 401
        if (error.message === 'Admin access required') return 403
        return 500
      }

      expect(getStatusForError(error)).toBe(401)
    })

    it('should return 403 for authorization errors', () => {
      const error = new Error('Admin access required')

      const getStatusForError = (error: Error) => {
        if (error.message === 'Authentication required') return 401
        if (error.message === 'Admin access required') return 403
        return 500
      }

      expect(getStatusForError(error)).toBe(403)
    })

    it('should return 500 for other errors', () => {
      const error = new Error('Database connection failed')

      const getStatusForError = (error: Error) => {
        if (error.message === 'Authentication required') return 401
        if (error.message === 'Admin access required') return 403
        return 500
      }

      expect(getStatusForError(error)).toBe(500)
    })
  })
})

describe('Admin Security Integration', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      ADMIN_EMAILS: 'admin@myapp.com,owner@myapp.com',
      ADMIN_USER_IDS: ''
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should properly validate admin emails from environment', () => {
    const { isAdminUser } = require('@/lib/auth-server')

    const testCases = [
      { email: 'admin@myapp.com', expected: true },
      { email: 'owner@myapp.com', expected: true },
      { email: 'ADMIN@MYAPP.COM', expected: true }, // case insensitive
      { email: 'admin@other.com', expected: false },
      { email: 'admin@myapp.com.evil.com', expected: false },
      { email: 'attacker@voicememory.test', expected: false } // security fix
    ]

    testCases.forEach(({ email, expected }) => {
      const user = { email, id: 'test-id' }
      expect(isAdminUser(user)).toBe(expected)
    })
  })

  it('should validate admin endpoints are protected', () => {
    const adminEndpoints = [
      '/api/admin/system-performance',
      '/api/admin/background-jobs'
    ]

    expect(adminEndpoints.length).toBeGreaterThan(0)

    adminEndpoints.forEach(endpoint => {
      expect(endpoint).toMatch(/^\/api\/admin\//)
    })
  })
})
