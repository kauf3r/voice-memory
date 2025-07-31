import { jest } from '@jest/globals'
import { POST } from '@/app/api/upload/route'
import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { uploadAudioFile } from '@/lib/storage'
import { quotaManager } from '@/lib/quota-manager'

// Mock dependencies
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/storage')
jest.mock('@/lib/quota-manager')

const mockCreateServerClient = createServerClient as jest.MockedFunction<typeof createServerClient>
const mockUploadAudioFile = uploadAudioFile as jest.MockedFunction<typeof uploadAudioFile>
const mockQuotaManager = quotaManager as jest.Mocked<typeof quotaManager>

describe('/api/upload', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
        setSession: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: [], error: null }),
    }
    
    mockCreateServerClient.mockReturnValue(mockSupabase)
    mockQuotaManager.checkStorageQuota.mockResolvedValue({ withinLimit: true, currentUsage: 0, limit: 1000 })
    mockQuotaManager.updateStorageUsage.mockResolvedValue()
  })

  const createMockRequest = (formData?: FormData, headers: Record<string, string> = {}) => {
    const request = new NextRequest('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'content-type': 'multipart/form-data',
        ...headers,
      },
    })
    
    return request
  }

  const createMockFormData = (fileName = 'test.mp3', fileContent = 'test audio content') => {
    const formData = new FormData()
    const file = new File([fileContent], fileName, { type: 'audio/mpeg' })
    formData.append('file', file)
    return formData
  }

  describe('Authentication', () => {
    it('should authenticate user with Bearer token', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      
      mockUploadAudioFile.mockResolvedValue({
        url: 'https://example.com/audio.mp3',
        error: null
      })

      const formData = createMockFormData()
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer valid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('valid-token')
      expect(mockSupabase.auth.setSession).toHaveBeenCalledWith({
        access_token: 'valid-token',
        refresh_token: 'valid-token'
      })
    })

    it('should fallback to cookie auth when Bearer token fails', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      // First call (with token) fails
      mockSupabase.auth.getUser
        .mockResolvedValueOnce({ data: { user: null }, error: new Error('Invalid token') })
        .mockResolvedValueOnce({ data: { user: mockUser }, error: null })
      
      mockUploadAudioFile.mockResolvedValue({
        url: 'https://example.com/audio.mp3',
        error: null
      })

      const formData = createMockFormData()
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer invalid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(2)
    })

    it('should return 401 when user is not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('No user found')
      })

      const formData = createMockFormData()
      const request = createMockRequest(formData)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('File Upload', () => {
    beforeEach(() => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
    })

    it('should successfully upload audio file', async () => {
      const expectedUrl = 'https://example.com/audio.mp3'
      
      mockUploadAudioFile.mockResolvedValue({
        url: expectedUrl,
        error: null
      })

      const formData = createMockFormData('test.mp3', 'test audio content')
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer valid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.url).toBe(expectedUrl)
      expect(mockUploadAudioFile).toHaveBeenCalledWith(
        expect.any(File),
        'user-123',
        mockSupabase
      )
    })

    it('should return 400 when no file is provided', async () => {
      const formData = new FormData() // Empty form data
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer valid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No file provided')
    })

    it('should validate file size limits', async () => {
      // Mock large file (over 25MB)
      const largeContent = 'x'.repeat(26 * 1024 * 1024)
      const formData = createMockFormData('large.mp3', largeContent)
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer valid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('File size exceeds')
    })

    it('should validate file type', async () => {
      const formData = new FormData()
      const invalidFile = new File(['text content'], 'document.txt', { type: 'text/plain' })
      formData.append('file', invalidFile)
      
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer valid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Unsupported file type')
    })

    it('should handle storage upload errors', async () => {
      const storageError = new Error('Storage upload failed')
      
      mockUploadAudioFile.mockResolvedValue({
        url: null,
        error: storageError
      })

      const formData = createMockFormData()
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer valid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to upload file')
    })

    it('should create note record in database', async () => {
      const expectedUrl = 'https://example.com/audio.mp3'
      
      mockUploadAudioFile.mockResolvedValue({
        url: expectedUrl,
        error: null
      })

      const formData = createMockFormData()
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer valid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSupabase.from).toHaveBeenCalledWith('notes')
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        audio_url: expectedUrl,
        created_at: expect.any(String),
        recorded_at: expect.any(String),
      })
    })

    it('should handle database insertion errors', async () => {
      mockUploadAudioFile.mockResolvedValue({
        url: 'https://example.com/audio.mp3',
        error: null
      })

      const dbError = new Error('Database insertion failed')
      mockSupabase.insert.mockResolvedValue({
        data: null,
        error: dbError
      })

      const formData = createMockFormData()
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer valid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to save note to database')
    })
  })

  describe('Quota Management', () => {
    beforeEach(() => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
    })

    it('should check storage quota before upload', async () => {
      mockQuotaManager.checkStorageQuota.mockResolvedValue({
        withinLimit: false,
        currentUsage: 1000,
        limit: 1000
      })

      const formData = createMockFormData()
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer valid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(507) // Insufficient Storage
      expect(data.error).toContain('Storage quota exceeded')
      expect(mockQuotaManager.checkStorageQuota).toHaveBeenCalledWith('user-123')
    })

    it('should update storage usage after successful upload', async () => {
      const fileSize = 1024 * 1024 // 1MB
      
      mockUploadAudioFile.mockResolvedValue({
        url: 'https://example.com/audio.mp3',
        error: null
      })

      const formData = createMockFormData('test.mp3', 'x'.repeat(fileSize))
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer valid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockQuotaManager.updateStorageUsage).toHaveBeenCalledWith('user-123', fileSize)
    })

    it('should handle quota manager errors gracefully', async () => {
      mockQuotaManager.checkStorageQuota.mockRejectedValue(new Error('Quota check failed'))

      mockUploadAudioFile.mockResolvedValue({
        url: 'https://example.com/audio.mp3',
        error: null
      })

      const formData = createMockFormData()
      const request = createMockRequest(formData, {
        'Authorization': 'Bearer valid-token'
      })

      const response = await POST(request)
      const data = await response.json()

      // Should proceed with upload even if quota check fails
      expect(response.status).toBe(200)
    })
  })

  describe('Supported File Types', () => {
    beforeEach(() => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      
      mockUploadAudioFile.mockResolvedValue({
        url: 'https://example.com/audio',
        error: null
      })
    })

    const supportedFormats = [
      { ext: 'mp3', type: 'audio/mpeg' },
      { ext: 'm4a', type: 'audio/mp4' },
      { ext: 'wav', type: 'audio/wav' },
      { ext: 'aac', type: 'audio/aac' },
      { ext: 'ogg', type: 'audio/ogg' },
      { ext: 'webm', type: 'audio/webm' },
    ]

    supportedFormats.forEach(({ ext, type }) => {
      it(`should accept ${ext.toUpperCase()} files`, async () => {
        const formData = new FormData()
        const file = new File(['audio content'], `test.${ext}`, { type })
        formData.append('file', file)
        
        const request = createMockRequest(formData, {
          'Authorization': 'Bearer valid-token'
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock an unexpected error
      mockCreateServerClient.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const formData = createMockFormData()
      const request = createMockRequest(formData)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })

    it('should handle malformed requests', async () => {
      // Create request without proper form data
      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: 'not form data',
        headers: {
          'content-type': 'text/plain',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No file provided')
    })
  })
})