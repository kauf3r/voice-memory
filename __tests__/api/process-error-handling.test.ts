import { NextRequest } from 'next/server'
import { POST, PUT } from '@/app/api/process/route'
import { createServerClient } from '@/lib/supabase-server'
import { processingService } from '@/lib/processing/ProcessingService'
import { quotaManager } from '@/lib/quota-manager'

// Mock dependencies
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/processing/ProcessingService')
jest.mock('@/lib/quota-manager')

const mockCreateServerClient = createServerClient as jest.MockedFunction<typeof createServerClient>
const mockProcessingService = processingService as jest.Mocked<typeof processingService>
const mockQuotaManager = quotaManager as jest.Mocked<typeof quotaManager>

describe('Process API Error Handling', () => {
  let mockSupabase: any

  // Helper function to create complete quota objects
  const createMockQuotaUsage = (overrides: Partial<any> = {}) => ({
    notesCount: 5,
    processingThisHour: 5,
    tokensToday: 1000,
    storageMB: 50,
    ...overrides
  })

  const createMockQuotaLimits = (overrides: Partial<any> = {}) => ({
    maxNotesPerUser: 100,
    maxProcessingPerHour: 10,
    maxTokensPerDay: 50000,
    maxStorageMB: 500,
    ...overrides
  })

  beforeEach(() => {
    jest.clearAllMocks()
    
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
        setSession: jest.fn()
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn()
    }
    
    mockCreateServerClient.mockReturnValue(mockSupabase)
  })

  describe('POST /api/process', () => {
    const createRequest = (body: any, headers: Record<string, string> = {}) => {
      return new NextRequest('http://localhost:3000/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body)
      })
    }

    describe('Authentication Errors', () => {
      it('should return 401 for missing authentication', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

        const request = createRequest({ noteId: 'test-note' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Authentication required')
        expect(data.code).toBe('AUTH_REQUIRED')
      })

      it('should return 401 for invalid token', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ 
          data: { user: null }, 
          error: { message: 'Invalid token' } 
        })

        const request = createRequest(
          { noteId: 'test-note' },
          { 'Authorization': 'Bearer invalid-token' }
        )
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(401)
        expect(data.error).toBe('Authentication required')
      })
    })

    describe('Validation Errors', () => {
      it('should return 400 for missing noteId', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ 
          data: { user: { id: 'user-1' } }, 
          error: null 
        })

        const request = createRequest({})
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid request')
        expect(data.code).toBe('VALIDATION_ERROR')
        expect(data.details).toBe('noteId is required')
      })

      it('should return 400 for invalid request body', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ 
          data: { user: { id: 'user-1' } }, 
          error: null 
        })

        const request = createRequest({ noteId: '' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid request')
      })
    })

    describe('Not Found Errors', () => {
      it('should return 404 for non-existent note', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ 
          data: { user: { id: 'user-1' } }, 
          error: null 
        })
        mockSupabase.single.mockResolvedValue({ 
          data: null, 
          error: { message: 'No rows returned' } 
        })

        const request = createRequest({ noteId: 'non-existent-note' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data.error).toBe('Resource not found')
        expect(data.code).toBe('NOT_FOUND')
      })
    })

    describe('Quota Errors', () => {
      it('should return 429 for quota exceeded', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ 
          data: { user: { id: 'user-1' } }, 
          error: null 
        })
        mockSupabase.single.mockResolvedValue({ 
          data: { id: 'note-1', user_id: 'user-1', processed_at: null }, 
          error: null 
        })
        
        mockQuotaManager.checkProcessingQuota.mockResolvedValue({
          allowed: false,
          reason: 'Processing limit exceeded',
          usage: { 
            notesCount: 5,
            processingThisHour: 10,
            tokensToday: 1000,
            storageMB: 50
          },
          limits: { 
            maxNotesPerUser: 100,
            maxProcessingPerHour: 10,
            maxTokensPerDay: 50000,
            maxStorageMB: 500
          }
        })

        const request = createRequest({ noteId: 'note-1' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(429)
        expect(data.error).toBe('Quota exceeded')
        expect(data.code).toBe('QUOTA_EXCEEDED')
        expect(data.details).toBe('Processing limit exceeded')
        expect(data.usage).toBeDefined()
        expect(data.limits).toBeDefined()
      })
    })

    describe('Processing Errors', () => {
      it('should return 422 for processing failures', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ 
          data: { user: { id: 'user-1' } }, 
          error: null 
        })
        mockSupabase.single.mockResolvedValue({ 
          data: { id: 'note-1', user_id: 'user-1', processed_at: null }, 
          error: null 
        })
        
        mockQuotaManager.checkProcessingQuota.mockResolvedValue({
          allowed: true,
          usage: createMockQuotaUsage({ processingThisHour: 5 }),
          limits: createMockQuotaLimits()
        })
        
        mockProcessingService.processNote.mockResolvedValue({
          success: false,
          error: 'Processing failed: Invalid audio format'
        })

        const request = createRequest({ noteId: 'note-1' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(422)
        expect(data.error).toBe('Processing failed')
        expect(data.code).toBe('PROCESSING_ERROR')
      })

      it('should return 502 for external service errors', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ 
          data: { user: { id: 'user-1' } }, 
          error: null 
        })
        mockSupabase.single.mockResolvedValue({ 
          data: { id: 'note-1', user_id: 'user-1', processed_at: null }, 
          error: null 
        })
        
        mockQuotaManager.checkProcessingQuota.mockResolvedValue({
          allowed: true,
          usage: createMockQuotaUsage({ processingThisHour: 5 }),
          limits: createMockQuotaLimits()
        })
        
        mockProcessingService.processNote.mockResolvedValue({
          success: false,
          error: 'OpenAI API rate limit exceeded'
        })

        const request = createRequest({ noteId: 'note-1' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(502)
        expect(data.error).toBe('External service error')
        expect(data.code).toBe('EXTERNAL_SERVICE_ERROR')
      })
    })

    describe('Storage Errors', () => {
      it('should return 500 for storage access errors', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ 
          data: { user: { id: 'user-1' } }, 
          error: null 
        })
        mockSupabase.single.mockResolvedValue({ 
          data: { id: 'note-1', user_id: 'user-1', processed_at: null }, 
          error: null 
        })
        
        mockQuotaManager.checkProcessingQuota.mockResolvedValue({
          allowed: true,
          usage: createMockQuotaUsage({ processingThisHour: 5 }),
          limits: createMockQuotaLimits()
        })
        
        mockProcessingService.processNote.mockResolvedValue({
          success: false,
          error: 'Could not retrieve audio file: Storage error'
        })

        const request = createRequest({ noteId: 'note-1' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Storage error')
        expect(data.code).toBe('STORAGE_ERROR')
      })
    })

    describe('Rate Limit Errors', () => {
      it('should return 429 with Retry-After header for rate limits', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ 
          data: { user: { id: 'user-1' } }, 
          error: null 
        })
        mockSupabase.single.mockResolvedValue({ 
          data: { id: 'note-1', user_id: 'user-1', processed_at: null }, 
          error: null 
        })
        
        mockQuotaManager.checkProcessingQuota.mockResolvedValue({
          allowed: true,
          usage: createMockQuotaUsage({ processingThisHour: 5 }),
          limits: createMockQuotaLimits()
        })
        
        mockProcessingService.processNote.mockResolvedValue({
          success: false,
          error: 'Rate limit exceeded for Whisper API'
        })

        const request = createRequest({ noteId: 'note-1' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(429)
        expect(data.error).toBe('Rate limit exceeded')
        expect(data.code).toBe('RATE_LIMIT_EXCEEDED')
        expect(response.headers.get('Retry-After')).toBe('60')
      })
    })

    describe('Success Cases', () => {
      it('should return 200 for successful processing', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ 
          data: { user: { id: 'user-1' } }, 
          error: null 
        })
        mockSupabase.single.mockResolvedValue({ 
          data: { id: 'note-1', user_id: 'user-1', processed_at: null }, 
          error: null 
        })
        
        mockQuotaManager.checkProcessingQuota.mockResolvedValue({
          allowed: true,
          usage: createMockQuotaUsage({ processingThisHour: 5 }),
          limits: createMockQuotaLimits()
        })
        
        mockProcessingService.processNote.mockResolvedValue({
          success: true,
          transcription: 'Test transcription',
          analysis: { summary: 'Test analysis' }
        })

        const request = createRequest({ noteId: 'note-1' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.message).toBe('Processing completed successfully')
      })

      it('should return 200 for already processed notes', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ 
          data: { user: { id: 'user-1' } }, 
          error: null 
        })
        mockSupabase.single.mockResolvedValue({ 
          data: { 
            id: 'note-1', 
            user_id: 'user-1', 
            processed_at: '2024-01-01T00:00:00Z' 
          }, 
          error: null 
        })

        const request = createRequest({ noteId: 'note-1' })
        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.message).toBe('Note already processed')
      })
    })
  })

  describe('PUT /api/process (Batch Processing)', () => {
    const createRequest = (headers: Record<string, string> = {}) => {
      return new NextRequest('http://localhost:3000/api/process', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      })
    }

    it('should return 401 for unauthenticated batch processing', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      const request = createRequest()
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })

    it('should return 200 for successful batch processing', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: { id: 'user-1' } }, 
        error: null 
      })
      
      mockProcessingService.processNextBatch.mockResolvedValue({
        processed: 3,
        failed: 1,
        errors: ['Note 4: Processing failed']
      })

      const request = createRequest()
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.processed).toBe(3)
      expect(data.failed).toBe(1)
      expect(data.errors).toHaveLength(1)
    })

    it('should return 500 for batch processing failures', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ 
        data: { user: { id: 'user-1' } }, 
        error: null 
      })
      
      mockProcessingService.processNextBatch.mockRejectedValue(
        new Error('Batch processing failed')
      )

      const request = createRequest()
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
}) 