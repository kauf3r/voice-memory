/**
 * API Response Caching Tests
 * 
 * Tests to verify that processed content APIs are properly implementing
 * HTTP caching headers for improved performance.
 */

import { NextRequest } from 'next/server'
import { GET as knowledgeGET } from '@/app/api/knowledge/route'
import { GET as notesGET } from '@/app/api/notes/route'
import { GET as searchGET } from '@/app/api/search/route'
import { GET as tasksGET } from '@/app/api/tasks/route'
import { GET as exportGET } from '@/app/api/knowledge/export/route'

// Mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(() => ({
        data: { user: { id: 'test-user', email: 'test@example.com' } },
        error: null
      }))
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          not: jest.fn(() => ({
            order: jest.fn(() => ({
              data: [
                {
                  id: 'note-1',
                  analysis: { keyIdeas: ['Test insight'] },
                  processed_at: '2024-01-01T10:00:00Z',
                  recorded_at: '2024-01-01T09:00:00Z',
                  updated_at: '2024-01-01T10:00:00Z'
                }
              ],
              error: null
            }))
          }))
        }))
      }))
    }))
  })),
  getAuthenticatedUser: jest.fn(() => ({
    user: { id: 'test-user', email: 'test@example.com' },
    error: null,
    client: {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: [
              {
                id: 'note-1',
                analysis: { keyIdeas: ['Test insight'] },
                processed_at: '2024-01-01T10:00:00Z',
                recorded_at: '2024-01-01T09:00:00Z',
                updated_at: '2024-01-01T10:00:00Z'
              }
            ],
            error: null
          }))
        }))
      }))
    }
  }))
}))

jest.mock('@/lib/database/queries', () => ({
  createDatabaseService: jest.fn(() => ({
    getNotesByUser: jest.fn(() => ({
      success: true,
      data: [
        {
          id: 'note-1',
          analysis: { keyIdeas: ['Test insight'] },
          processed_at: '2024-01-01T10:00:00Z'
        }
      ]
    }))
  }))
}))

jest.mock('@/lib/services/TaskStateService', () => ({
  TaskStateService: jest.fn(() => ({
    getTaskStates: jest.fn(() => [])
  }))
}))

describe('API Response Caching', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Knowledge API Caching', () => {
    it('should include proper cache headers in knowledge response', async () => {
      const mockUrl = 'http://localhost:3000/api/knowledge'
      const request = new NextRequest(mockUrl, {
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await knowledgeGET(request)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toContain('private')
      expect(response.headers.get('Cache-Control')).toContain('max-age=300')
      expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate=600')
      expect(response.headers.get('ETag')).toBeTruthy()
      expect(response.headers.get('Last-Modified')).toBeTruthy()
      expect(response.headers.get('Vary')).toContain('Authorization')
    })

    it('should return 304 when ETag matches', async () => {
      const mockUrl = 'http://localhost:3000/api/knowledge'
      const request1 = new NextRequest(mockUrl, {
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response1 = await knowledgeGET(request1)
      const etag = response1.headers.get('ETag')

      const request2 = new NextRequest(mockUrl, {
        headers: {
          'authorization': 'Bearer test-token',
          'if-none-match': etag!
        }
      })

      const response2 = await knowledgeGET(request2)
      expect(response2.status).toBe(304)
    })
  })

  describe('Notes API Caching', () => {
    it('should include proper cache headers in notes response', async () => {
      const mockUrl = 'http://localhost:3000/api/notes'
      const request = new NextRequest(mockUrl, {
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await notesGET(request)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toContain('private')
      expect(response.headers.get('Cache-Control')).toContain('max-age=120')
      expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate=300')
      expect(response.headers.get('ETag')).toBeTruthy()
      expect(response.headers.get('Last-Modified')).toBeTruthy()
    })
  })

  describe('Search API Caching', () => {
    it('should include proper cache headers in search response', async () => {
      const mockUrl = 'http://localhost:3000/api/search?q=test'
      const request = new NextRequest(mockUrl, {
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await searchGET(request)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toContain('private')
      expect(response.headers.get('Cache-Control')).toContain('max-age=180')
      expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate=360')
      expect(response.headers.get('ETag')).toBeTruthy()
    })

    it('should return empty results for empty query', async () => {
      const mockUrl = 'http://localhost:3000/api/search?q='
      const request = new NextRequest(mockUrl, {
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await searchGET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.results).toEqual([])
      expect(data.total).toBe(0)
    })
  })

  describe('Tasks API Caching', () => {
    it('should include proper cache headers in tasks response', async () => {
      const mockUrl = 'http://localhost:3000/api/tasks'
      const request = new NextRequest(mockUrl, {
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await tasksGET(request)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toContain('private')
      expect(response.headers.get('Cache-Control')).toContain('max-age=60')
      expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate=180')
      expect(response.headers.get('ETag')).toBeTruthy()
    })
  })

  describe('Export API Caching', () => {
    it('should include proper cache headers in export response', async () => {
      const mockUrl = 'http://localhost:3000/api/knowledge/export?format=json'
      const request = new NextRequest(mockUrl, {
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response = await exportGET(request)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toContain('private')
      expect(response.headers.get('Cache-Control')).toContain('max-age=900')
      expect(response.headers.get('Cache-Control')).toContain('stale-while-revalidate=1800')
      expect(response.headers.get('ETag')).toBeTruthy()
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('should return 304 for matching ETag in export', async () => {
      const mockUrl = 'http://localhost:3000/api/knowledge/export?format=json'
      const request1 = new NextRequest(mockUrl, {
        headers: {
          'authorization': 'Bearer test-token'
        }
      })

      const response1 = await exportGET(request1)
      const etag = response1.headers.get('ETag')

      const request2 = new NextRequest(mockUrl, {
        headers: {
          'authorization': 'Bearer test-token',
          'if-none-match': etag!
        }
      })

      const response2 = await exportGET(request2)
      expect(response2.status).toBe(304)
    })
  })

  describe('Cache Configuration Validation', () => {
    it('should have different cache durations for different content types', () => {
      const { CACHE_CONFIGS } = require('@/lib/cache/response-cache')
      
      expect(CACHE_CONFIGS.KNOWLEDGE.maxAge).toBe(300) // 5 minutes
      expect(CACHE_CONFIGS.NOTES.maxAge).toBe(120) // 2 minutes
      expect(CACHE_CONFIGS.SEARCH.maxAge).toBe(180) // 3 minutes
      expect(CACHE_CONFIGS.TASKS.maxAge).toBe(60) // 1 minute
      expect(CACHE_CONFIGS.EXPORTS.maxAge).toBe(900) // 15 minutes
      
      // All should be private and have ETag enabled
      Object.values(CACHE_CONFIGS).forEach(config => {
        expect(config.private).toBe(true)
        expect(config.etag).toBe(true)
      })
    })
  })

  describe('Authentication Required', () => {
    it('should return 401 without authorization header', async () => {
      const mockUrl = 'http://localhost:3000/api/knowledge'
      const request = new NextRequest(mockUrl)

      const response = await knowledgeGET(request)
      
      expect(response.status).toBe(401)
      // Should not include cache headers for unauthenticated requests
      expect(response.headers.get('Cache-Control')).toBeFalsy()
    })
  })
})