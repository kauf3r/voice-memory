import { NextRequest } from 'next/server'
import { POST } from '@/app/api/upload/route'

// Mock dependencies
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/storage')
jest.mock('@/lib/quota-manager')
jest.mock('@/lib/supabase', () => ({
  supabase: {}
}))

const mockSupabase = {
  auth: {
    getUser: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    }))
  }))
}

const mockQuotaManager = {
  checkUploadQuota: jest.fn()
}

const mockStorage = {
  uploadAudioFile: jest.fn()
}

// Set up mocks
require('@/lib/supabase-server').createServerClient = jest.fn(() => mockSupabase)
require('@/lib/quota-manager').quotaManager = mockQuotaManager
require('@/lib/storage').uploadAudioFile = mockStorage.uploadAudioFile

describe('/api/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('requires authentication', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: 'Not authenticated'
    })

    const formData = new FormData()
    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  test('requires file in request', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user123' } },
      error: null
    })

    const formData = new FormData()
    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    
    const data = await response.json()
    expect(data.error).toBe('No file provided')
  })

  test('validates file type', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user123' } },
      error: null
    })

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    const formData = new FormData()
    formData.append('file', file)

    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    
    const data = await response.json()
    expect(data.error).toContain('not supported')
  })

  test('validates file size', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user123' } },
      error: null
    })

    // Create file larger than 25MB
    const largeContent = 'x'.repeat(26 * 1024 * 1024)
    const file = new File([largeContent], 'large.mp3', { type: 'audio/mpeg' })
    const formData = new FormData()
    formData.append('file', file)

    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    expect(response.status).toBe(413)
    
    const data = await response.json()
    expect(data.error).toBe('File too large. Maximum size is 25MB')
  })

  test('checks quota limits', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user123' } },
      error: null
    })

    mockQuotaManager.checkUploadQuota.mockResolvedValue({
      allowed: false,
      reason: 'Quota exceeded',
      usage: {},
      limits: {}
    })

    const file = new File(['content'], 'test.mp3', { type: 'audio/mpeg' })
    const formData = new FormData()
    formData.append('file', file)

    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    expect(response.status).toBe(507)
  })

  test('successfully uploads valid file', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user123' } },
      error: null
    })

    mockQuotaManager.checkUploadQuota.mockResolvedValue({
      allowed: true,
      usage: {},
      limits: {}
    })

    mockStorage.uploadAudioFile.mockResolvedValue({
      url: 'https://example.com/audio.mp3',
      error: null
    })

    mockSupabase.from().insert().select().single.mockResolvedValue({
      data: { id: 'note123', audio_url: 'https://example.com/audio.mp3' },
      error: null
    })

    const file = new File(['content'], 'test.mp3', { type: 'audio/mpeg' })
    const formData = new FormData()
    formData.append('file', file)

    const request = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.url).toBe('https://example.com/audio.mp3')
  })
})