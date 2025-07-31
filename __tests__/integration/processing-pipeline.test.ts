import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { processingService } from '@/lib/processing-service'
import { createServiceClient } from '@/lib/supabase-server'
import { transcribeAudio, analyzeTranscription } from '@/lib/openai'

// Mock OpenAI functions
jest.mock('@/lib/openai', () => ({
  transcribeAudio: jest.fn(),
  analyzeTranscription: jest.fn(),
}))

// Mock Supabase client
jest.mock('@/lib/supabase-server', () => ({
  createServiceClient: jest.fn(),
}))

describe('Processing Pipeline Integration', () => {
  let mockSupabase: any
  let mockTranscribeAudio: jest.MockedFunction<typeof transcribeAudio>
  let mockAnalyzeTranscription: jest.MockedFunction<typeof analyzeTranscription>

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()

    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      storage: {
        from: jest.fn().mockReturnThis(),
        download: jest.fn(),
      },
    }

    ;(createServiceClient as jest.Mock).mockReturnValue(mockSupabase)

    // Setup mock OpenAI functions
    mockTranscribeAudio = transcribeAudio as jest.MockedFunction<typeof transcribeAudio>
    mockAnalyzeTranscription = analyzeTranscription as jest.MockedFunction<typeof analyzeTranscription>
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('processNote', () => {
    it('should successfully process a note from start to finish', async () => {
      // Mock note data
      const mockNote = {
        id: 'test-note-id',
        user_id: 'test-user-id',
        audio_url: 'https://example.com/audio/test.m4a',
        recorded_at: '2024-01-19T10:00:00Z',
        transcription: null,
        analysis: null,
        processed_at: null,
        processing_attempts: 0,
      }

      // Mock storage response
      const mockAudioBlob = new Blob(['fake audio data'], { type: 'audio/mp4' })
      mockSupabase.storage.download.mockResolvedValue({
        data: mockAudioBlob,
        error: null,
      })

      // Mock note fetch
      mockSupabase.single.mockResolvedValue({
        data: mockNote,
        error: null,
      })

      // Mock transcription
      mockTranscribeAudio.mockResolvedValue({
        text: 'This is a test transcription',
        error: null,
      })

      // Mock analysis
      const mockAnalysis = {
        sentiment: {
          classification: 'Positive' as const,
          explanation: 'Test sentiment',
        },
        focusTopics: {
          primary: 'Test Topic',
          minor: ['Topic 1', 'Topic 2'],
        },
        tasks: {
          myTasks: ['Task 1'],
          delegatedTasks: [],
        },
        keyIdeas: ['Idea 1'],
        messagesToDraft: [],
        crossReferences: {
          relatedNotes: [],
          projectKnowledgeUpdates: [],
        },
        outreachIdeas: [],
        structuredData: {
          dates: [],
          times: [],
          locations: [],
          numbers: [],
          people: [],
        },
        recordingContext: {
          recordedAt: '2024-01-19T10:00:00Z',
          timeReferences: [],
        },
      }

      mockAnalyzeTranscription.mockResolvedValue({
        analysis: mockAnalysis,
        error: null,
      })

      // Mock project knowledge
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null,
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        return mockSupabase
      })

      // Mock note update
      mockSupabase.update.mockResolvedValue({ error: null })

      // Execute processing
      const result = await processingService.processNote('test-note-id', 'test-user-id')

      // Verify result
      expect(result.success).toBe(true)
      expect(result.transcription).toBe('This is a test transcription')
      expect(result.analysis).toEqual(mockAnalysis)

      // Verify OpenAI calls
      expect(mockTranscribeAudio).toHaveBeenCalledTimes(1)
      expect(mockAnalyzeTranscription).toHaveBeenCalledTimes(1)
      expect(mockAnalyzeTranscription).toHaveBeenCalledWith(
        'This is a test transcription',
        '{}',
        '2024-01-19T10:00:00Z'
      )
    })

    it('should handle transcription failure', async () => {
      // Mock note data
      const mockNote = {
        id: 'test-note-id',
        user_id: 'test-user-id',
        audio_url: 'https://example.com/audio/test.m4a',
        recorded_at: '2024-01-19T10:00:00Z',
        transcription: null,
        analysis: null,
        processed_at: null,
        processing_attempts: 0,
      }

      // Mock storage response
      const mockAudioBlob = new Blob(['fake audio data'], { type: 'audio/mp4' })
      mockSupabase.storage.download.mockResolvedValue({
        data: mockAudioBlob,
        error: null,
      })

      // Mock note fetch
      mockSupabase.single.mockResolvedValue({
        data: mockNote,
        error: null,
      })

      // Mock transcription failure
      mockTranscribeAudio.mockResolvedValue({
        text: null,
        error: new Error('Transcription failed'),
      })

      // Execute processing
      const result = await processingService.processNote('test-note-id', 'test-user-id')

      // Verify result
      expect(result.success).toBe(false)
      expect(result.error).toContain('Transcription failed')

      // Verify OpenAI was called
      expect(mockTranscribeAudio).toHaveBeenCalledTimes(1)
      expect(mockAnalyzeTranscription).not.toHaveBeenCalled()
    })

    it('should handle analysis failure', async () => {
      // Mock note data
      const mockNote = {
        id: 'test-note-id',
        user_id: 'test-user-id',
        audio_url: 'https://example.com/audio/test.m4a',
        recorded_at: '2024-01-19T10:00:00Z',
        transcription: 'This is a test transcription',
        analysis: null,
        processed_at: null,
        processing_attempts: 0,
      }

      // Mock note fetch
      mockSupabase.single.mockResolvedValue({
        data: mockNote,
        error: null,
      })

      // Mock analysis failure
      mockAnalyzeTranscription.mockResolvedValue({
        analysis: null,
        error: new Error('Analysis failed'),
      })

      // Mock project knowledge
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      // Execute processing
      const result = await processingService.processNote('test-note-id', 'test-user-id')

      // Verify result
      expect(result.success).toBe(false)
      expect(result.error).toContain('Analysis failed')

      // Verify OpenAI was called
      expect(mockTranscribeAudio).not.toHaveBeenCalled()
      expect(mockAnalyzeTranscription).toHaveBeenCalledTimes(1)
    })

    it('should handle storage errors', async () => {
      // Mock note data
      const mockNote = {
        id: 'test-note-id',
        user_id: 'test-user-id',
        audio_url: 'https://example.com/audio/test.m4a',
        recorded_at: '2024-01-19T10:00:00Z',
        transcription: null,
        analysis: null,
        processed_at: null,
        processing_attempts: 0,
      }

      // Mock note fetch
      mockSupabase.single.mockResolvedValue({
        data: mockNote,
        error: null,
      })

      // Mock storage error
      mockSupabase.storage.download.mockResolvedValue({
        data: null,
        error: { message: 'File not found' },
      })

      // Execute processing
      const result = await processingService.processNote('test-note-id', 'test-user-id')

      // Verify result
      expect(result.success).toBe(false)
      expect(result.error).toContain('Could not retrieve audio file')

      // Verify OpenAI was not called
      expect(mockTranscribeAudio).not.toHaveBeenCalled()
      expect(mockAnalyzeTranscription).not.toHaveBeenCalled()
    })

    it('should skip processing if note is already processed', async () => {
      // Mock note data (already processed)
      const mockNote = {
        id: 'test-note-id',
        user_id: 'test-user-id',
        audio_url: 'https://example.com/audio/test.m4a',
        recorded_at: '2024-01-19T10:00:00Z',
        transcription: 'Existing transcription',
        analysis: { sentiment: { classification: 'Positive' } },
        processed_at: '2024-01-19T10:05:00Z',
        processing_attempts: 1,
      }

      // Mock note fetch
      mockSupabase.single.mockResolvedValue({
        data: mockNote,
        error: null,
      })

      // Execute processing
      const result = await processingService.processNote('test-note-id', 'test-user-id')

      // Verify result
      expect(result.success).toBe(true)
      expect(result.transcription).toBe('Existing transcription')

      // Verify OpenAI was not called
      expect(mockTranscribeAudio).not.toHaveBeenCalled()
      expect(mockAnalyzeTranscription).not.toHaveBeenCalled()
    })

    it('should force reprocess when forceReprocess is true', async () => {
      // Mock note data (already processed)
      const mockNote = {
        id: 'test-note-id',
        user_id: 'test-user-id',
        audio_url: 'https://example.com/audio/test.m4a',
        recorded_at: '2024-01-19T10:00:00Z',
        transcription: 'Existing transcription',
        analysis: { sentiment: { classification: 'Positive' } },
        processed_at: '2024-01-19T10:05:00Z',
        processing_attempts: 1,
      }

      // Mock storage response
      const mockAudioBlob = new Blob(['fake audio data'], { type: 'audio/mp4' })
      mockSupabase.storage.download.mockResolvedValue({
        data: mockAudioBlob,
        error: null,
      })

      // Mock note fetch
      mockSupabase.single.mockResolvedValue({
        data: mockNote,
        error: null,
      })

      // Mock transcription
      mockTranscribeAudio.mockResolvedValue({
        text: 'New transcription',
        error: null,
      })

      // Mock analysis
      mockAnalyzeTranscription.mockResolvedValue({
        analysis: { sentiment: { classification: 'Neutral' } },
        error: null,
      })

      // Mock project knowledge
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null,
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        return mockSupabase
      })

      // Mock note update
      mockSupabase.update.mockResolvedValue({ error: null })

      // Execute processing with force reprocess
      const result = await processingService.processNote('test-note-id', 'test-user-id', true)

      // Verify result
      expect(result.success).toBe(true)
      expect(result.transcription).toBe('New transcription')

      // Verify OpenAI was called (force reprocess)
      expect(mockTranscribeAudio).toHaveBeenCalledTimes(1)
      expect(mockAnalyzeTranscription).toHaveBeenCalledTimes(1)
    })
  })

  describe('processNextBatch', () => {
    it('should process multiple notes in batch', async () => {
      // Mock notes to process
      const mockNotes = [
        {
          id: 'note-1',
          user_id: 'test-user-id',
          audio_url: 'https://example.com/audio/test1.m4a',
          recorded_at: '2024-01-19T10:00:00Z',
          transcription: null,
          analysis: null,
          processed_at: null,
          processing_attempts: 0,
        },
        {
          id: 'note-2',
          user_id: 'test-user-id',
          audio_url: 'https://example.com/audio/test2.m4a',
          recorded_at: '2024-01-19T10:01:00Z',
          transcription: null,
          analysis: null,
          processed_at: null,
          processing_attempts: 0,
        },
      ]

      // Mock notes fetch
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'notes') {
          return {
            select: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: mockNotes,
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      // Mock individual note processing
      mockSupabase.single.mockResolvedValue({
        data: mockNotes[0],
        error: null,
      })

      // Mock storage response
      const mockAudioBlob = new Blob(['fake audio data'], { type: 'audio/mp4' })
      mockSupabase.storage.download.mockResolvedValue({
        data: mockAudioBlob,
        error: null,
      })

      // Mock transcription
      mockTranscribeAudio.mockResolvedValue({
        text: 'Test transcription',
        error: null,
      })

      // Mock analysis
      mockAnalyzeTranscription.mockResolvedValue({
        analysis: { sentiment: { classification: 'Positive' } },
        error: null,
      })

      // Mock project knowledge
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null,
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        return mockSupabase
      })

      // Mock note update
      mockSupabase.update.mockResolvedValue({ error: null })

      // Execute batch processing
      const result = await processingService.processNextBatch(2)

      // Verify result
      expect(result.processed).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle batch processing with mixed success/failure', async () => {
      // Mock notes to process
      const mockNotes = [
        {
          id: 'note-1',
          user_id: 'test-user-id',
          audio_url: 'https://example.com/audio/test1.m4a',
          recorded_at: '2024-01-19T10:00:00Z',
          transcription: null,
          analysis: null,
          processed_at: null,
          processing_attempts: 0,
        },
        {
          id: 'note-2',
          user_id: 'test-user-id',
          audio_url: 'https://example.com/audio/test2.m4a',
          recorded_at: '2024-01-19T10:01:00Z',
          transcription: null,
          analysis: null,
          processed_at: null,
          processing_attempts: 0,
        },
      ]

      // Mock notes fetch
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'notes') {
          return {
            select: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
              data: mockNotes,
              error: null,
            }),
          }
        }
        return mockSupabase
      })

      // Mock individual note processing - first success, second failure
      mockSupabase.single
        .mockResolvedValueOnce({
          data: mockNotes[0],
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockNotes[1],
          error: null,
        })

      // Mock storage response
      const mockAudioBlob = new Blob(['fake audio data'], { type: 'audio/mp4' })
      mockSupabase.storage.download.mockResolvedValue({
        data: mockAudioBlob,
        error: null,
      })

      // Mock transcription - first success, second failure
      mockTranscribeAudio
        .mockResolvedValueOnce({
          text: 'Test transcription',
          error: null,
        })
        .mockResolvedValueOnce({
          text: null,
          error: new Error('Transcription failed'),
        })

      // Mock analysis
      mockAnalyzeTranscription.mockResolvedValue({
        analysis: { sentiment: { classification: 'Positive' } },
        error: null,
      })

      // Mock project knowledge
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null,
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        return mockSupabase
      })

      // Mock note update
      mockSupabase.update.mockResolvedValue({ error: null })

      // Execute batch processing
      const result = await processingService.processNextBatch(2)

      // Verify result
      expect(result.processed).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Transcription failed')
    })
  })
}) 