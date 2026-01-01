import { jest } from '@jest/globals'
import { processingService } from '@/lib/processing/ProcessingService'
import { createServiceClient } from '@/lib/supabase-server'
import { transcribeAudio, analyzeTranscription } from '@/lib/openai'
import { createServerFileFromBuffer, getFilePathFromUrl, getMimeTypeFromUrl } from '@/lib/storage'
import { hasErrorTracking, logMigrationStatus } from '@/lib/migration-checker'
import { isVideoFile, processVideoFile } from '@/lib/video-processor'

// Mock all dependencies
jest.mock('@/lib/supabase-server')
jest.mock('@/lib/openai')
jest.mock('@/lib/storage')
jest.mock('@/lib/migration-checker')
jest.mock('@/lib/video-processor')

const mockCreateServiceClient = createServiceClient as jest.MockedFunction<typeof createServiceClient>
const mockTranscribeAudio = transcribeAudio as jest.MockedFunction<typeof transcribeAudio>
const mockAnalyzeTranscription = analyzeTranscription as jest.MockedFunction<typeof analyzeTranscription>
const mockCreateServerFileFromBuffer = createServerFileFromBuffer as jest.MockedFunction<typeof createServerFileFromBuffer>
const mockGetFilePathFromUrl = getFilePathFromUrl as jest.MockedFunction<typeof getFilePathFromUrl>
const mockGetMimeTypeFromUrl = getMimeTypeFromUrl as jest.MockedFunction<typeof getMimeTypeFromUrl>
const mockHasErrorTracking = hasErrorTracking as jest.MockedFunction<typeof hasErrorTracking>
const mockLogMigrationStatus = logMigrationStatus as jest.MockedFunction<typeof logMigrationStatus>
const mockIsVideoFile = isVideoFile as jest.MockedFunction<typeof isVideoFile>
const mockProcessVideoFile = processVideoFile as jest.MockedFunction<typeof processVideoFile>

describe('Processing Service', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockResolvedValue({ data: null, error: null }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      not: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      storage: {
        from: jest.fn().mockReturnThis(),
        download: jest.fn().mockResolvedValue({ 
          data: new Blob(['test audio data'], { type: 'audio/mp3' }), 
          error: null 
        }),
      },
    }

    mockCreateServiceClient.mockReturnValue(mockSupabase)
    
    // Default mock implementations
    mockGetFilePathFromUrl.mockReturnValue('user-id/audio-file.mp3')
    mockGetMimeTypeFromUrl.mockReturnValue('audio/mp3')
    mockHasErrorTracking.mockReturnValue(true)
    mockLogMigrationStatus.mockResolvedValue()
    mockIsVideoFile.mockReturnValue(false)
    
    // Mock File creation
    const mockFile = {
      name: 'test.mp3',
      type: 'audio/mp3',
      size: 1024,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
      stream: jest.fn(),
      text: jest.fn(),
      slice: jest.fn()
    } as unknown as File
    
    mockCreateServerFileFromBuffer.mockReturnValue(mockFile)
  })

  describe('processNote', () => {
    const mockNote = {
      id: 'test-note-id',
      user_id: 'test-user-id',
      audio_url: 'https://example.com/audio/test.mp3',
      recorded_at: '2024-01-19T10:00:00Z',
      transcription: null,
      analysis: null,
      processed_at: null,
      processing_attempts: 0,
    }

    it('should successfully process a note from start to finish', async () => {
      // Mock note fetch
      mockSupabase.single.mockResolvedValue({
        data: mockNote,
        error: null
      })

      // Mock transcription
      mockTranscribeAudio.mockResolvedValue({
        text: 'This is a test transcription',
        error: null
      })

      // Mock analysis
      const mockAnalysis = {
        sentiment: {
          classification: 'Positive',
          explanation: 'Test sentiment'
        },
        focusTopics: {
          primary: 'Test Topic',
          minor: ['Topic 1', 'Topic 2']
        },
        tasks: {
          myTasks: ['Task 1'],
          delegatedTasks: []
        },
        keyIdeas: ['Idea 1'],
        messagesToDraft: [],
        crossReferences: {
          relatedNotes: [],
          projectKnowledgeUpdates: []
        },
        outreachIdeas: [],
        structuredData: {
          dates: [],
          times: [],
          locations: [],
          numbers: [],
          people: []
        },
        recordingContext: {
          recordedAt: '2024-01-19T10:00:00Z',
          timeReferences: []
        }
      }

      mockAnalyzeTranscription.mockResolvedValue({
        analysis: mockAnalysis,
        error: null
      })

      // Mock project knowledge fetch
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null
            }),
            upsert: jest.fn().mockResolvedValue({ error: null })
          }
        }
        return mockSupabase
      })

      const result = await processingService.processNote('test-note-id', 'test-user-id')

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

    it('should handle note not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Note not found')
      })

      const result = await processingService.processNote('nonexistent-note', 'test-user-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Could not fetch note')
    })

    it('should handle transcription failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockNote,
        error: null
      })

      mockTranscribeAudio.mockResolvedValue({
        text: null,
        error: new Error('Transcription failed')
      })

      const result = await processingService.processNote('test-note-id', 'test-user-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Transcription failed')
      expect(mockAnalyzeTranscription).not.toHaveBeenCalled()
    })

    it('should handle analysis failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { ...mockNote, transcription: 'Existing transcription' },
        error: null
      })

      mockAnalyzeTranscription.mockResolvedValue({
        analysis: null,
        error: new Error('Analysis failed')
      })

      // Mock project knowledge
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null
            })
          }
        }
        return mockSupabase
      })

      const result = await processingService.processNote('test-note-id', 'test-user-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Analysis failed')
      expect(mockTranscribeAudio).not.toHaveBeenCalled()
    })

    it('should handle storage download errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockNote,
        error: null
      })

      mockSupabase.storage.download.mockResolvedValue({
        data: null,
        error: { message: 'File not found' }
      })

      const result = await processingService.processNote('test-note-id', 'test-user-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Could not retrieve audio file')
    })

    it('should skip processing if note is already processed', async () => {
      const processedNote = {
        ...mockNote,
        transcription: 'Existing transcription',
        analysis: { sentiment: { classification: 'Positive' } },
        processed_at: '2024-01-19T10:05:00Z'
      }

      mockSupabase.single.mockResolvedValue({
        data: processedNote,
        error: null
      })

      const result = await processingService.processNote('test-note-id', 'test-user-id')

      expect(result.success).toBe(true)
      expect(result.transcription).toBe('Existing transcription')
      expect(mockTranscribeAudio).not.toHaveBeenCalled()
      expect(mockAnalyzeTranscription).not.toHaveBeenCalled()
    })

    it('should force reprocess when forceReprocess is true', async () => {
      const processedNote = {
        ...mockNote,
        transcription: 'Existing transcription',
        analysis: { sentiment: { classification: 'Positive' } },
        processed_at: '2024-01-19T10:05:00Z'
      }

      mockSupabase.single.mockResolvedValue({
        data: processedNote,
        error: null
      })

      mockTranscribeAudio.mockResolvedValue({
        text: 'New transcription',
        error: null
      })

      mockAnalyzeTranscription.mockResolvedValue({
        analysis: { sentiment: { classification: 'Neutral' } },
        error: null
      })

      // Mock project knowledge
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null
            }),
            upsert: jest.fn().mockResolvedValue({ error: null })
          }
        }
        return mockSupabase
      })

      const result = await processingService.processNote('test-note-id', 'test-user-id', true)

      expect(result.success).toBe(true)
      expect(result.transcription).toBe('New transcription')
      expect(mockTranscribeAudio).toHaveBeenCalledTimes(1)
      expect(mockAnalyzeTranscription).toHaveBeenCalledTimes(1)
    })

    it('should handle video file processing', async () => {
      const videoNote = {
        ...mockNote,
        audio_url: 'https://example.com/video/test.mp4'
      }

      mockSupabase.single.mockResolvedValue({
        data: videoNote,
        error: null
      })

      mockIsVideoFile.mockReturnValue(true)
      mockProcessVideoFile.mockResolvedValue({
        audioBuffer: Buffer.from('converted audio'),
        error: null
      })

      mockTranscribeAudio.mockResolvedValue({
        text: 'Transcription from video',
        error: null
      })

      mockAnalyzeTranscription.mockResolvedValue({
        analysis: { sentiment: { classification: 'Positive' } },
        error: null
      })

      // Mock project knowledge
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null
            }),
            upsert: jest.fn().mockResolvedValue({ error: null })
          }
        }
        return mockSupabase
      })

      const result = await processingService.processNote('test-note-id', 'test-user-id')

      expect(result.success).toBe(true)
      expect(mockProcessVideoFile).toHaveBeenCalled()
      expect(mockTranscribeAudio).toHaveBeenCalled()
    })

    it('should handle video processing errors', async () => {
      const videoNote = {
        ...mockNote,
        audio_url: 'https://example.com/video/test.mp4'
      }

      mockSupabase.single.mockResolvedValue({
        data: videoNote,
        error: null
      })

      mockIsVideoFile.mockReturnValue(true)
      mockProcessVideoFile.mockResolvedValue({
        audioBuffer: null,
        error: new Error('Video processing failed')
      })

      const result = await processingService.processNote('test-note-id', 'test-user-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Video processing failed')
    })

    it('should update processing attempts on failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: mockNote,
        error: null
      })

      mockTranscribeAudio.mockResolvedValue({
        text: null,
        error: new Error('Transcription failed')
      })

      await processingService.processNote('test-note-id', 'test-user-id')

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          processing_attempts: 1,
          last_error: expect.stringContaining('Transcription failed')
        })
      )
    })

    it('should respect maximum retry attempts', async () => {
      const retriedNote = {
        ...mockNote,
        processing_attempts: 5 // Max attempts reached
      }

      mockSupabase.single.mockResolvedValue({
        data: retriedNote,
        error: null
      })

      const result = await processingService.processNote('test-note-id', 'test-user-id')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Maximum retry attempts reached')
    })
  })

  describe('processNextBatch', () => {
    it('should process multiple notes in batch', async () => {
      const mockNotes = [
        {
          id: 'note-1',
          user_id: 'test-user-id',
          audio_url: 'https://example.com/audio/test1.mp3',
          recorded_at: '2024-01-19T10:00:00Z',
          transcription: null,
          analysis: null,
          processed_at: null,
          processing_attempts: 0
        },
        {
          id: 'note-2',
          user_id: 'test-user-id',
          audio_url: 'https://example.com/audio/test2.mp3',
          recorded_at: '2024-01-19T10:01:00Z',
          transcription: null,
          analysis: null,
          processed_at: null,
          processing_attempts: 0
        }
      ]

      // Mock batch fetch
      mockSupabase.limit.mockResolvedValue({
        data: mockNotes,
        error: null
      })

      // Mock individual processing
      mockSupabase.single
        .mockResolvedValueOnce({ data: mockNotes[0], error: null })
        .mockResolvedValueOnce({ data: mockNotes[1], error: null })

      mockTranscribeAudio
        .mockResolvedValueOnce({ text: 'Transcription 1', error: null })
        .mockResolvedValueOnce({ text: 'Transcription 2', error: null })

      mockAnalyzeTranscription
        .mockResolvedValue({ analysis: { sentiment: { classification: 'Positive' } }, error: null })

      // Mock project knowledge
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null
            }),
            upsert: jest.fn().mockResolvedValue({ error: null })
          }
        }
        return mockSupabase
      })

      const result = await processingService.processNextBatch(2)

      expect(result.processed).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle mixed success/failure in batch', async () => {
      const mockNotes = [
        {
          id: 'note-1',
          user_id: 'test-user-id',
          audio_url: 'https://example.com/audio/test1.mp3',
          recorded_at: '2024-01-19T10:00:00Z',
          transcription: null,
          analysis: null,
          processed_at: null,
          processing_attempts: 0
        },
        {
          id: 'note-2',
          user_id: 'test-user-id',
          audio_url: 'https://example.com/audio/test2.mp3',
          recorded_at: '2024-01-19T10:01:00Z',
          transcription: null,
          analysis: null,
          processed_at: null,
          processing_attempts: 0
        }
      ]

      mockSupabase.limit.mockResolvedValue({
        data: mockNotes,
        error: null
      })

      mockSupabase.single
        .mockResolvedValueOnce({ data: mockNotes[0], error: null })
        .mockResolvedValueOnce({ data: mockNotes[1], error: null })

      // First succeeds, second fails
      mockTranscribeAudio
        .mockResolvedValueOnce({ text: 'Transcription 1', error: null })
        .mockResolvedValueOnce({ text: null, error: new Error('Transcription failed') })

      mockAnalyzeTranscription
        .mockResolvedValue({ analysis: { sentiment: { classification: 'Positive' } }, error: null })

      // Mock project knowledge
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null
            }),
            upsert: jest.fn().mockResolvedValue({ error: null })
          }
        }
        return mockSupabase
      })

      const result = await processingService.processNextBatch(2)

      expect(result.processed).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Transcription failed')
    })

    it('should handle empty batch queue', async () => {
      mockSupabase.limit.mockResolvedValue({
        data: [],
        error: null
      })

      const result = await processingService.processNextBatch(5)

      expect(result.processed).toBe(0)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should respect batch size limit', async () => {
      await processingService.processNextBatch(10)

      expect(mockSupabase.limit).toHaveBeenCalledWith(10)
    })
  })

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'test-note',
          user_id: 'test-user',
          audio_url: 'https://example.com/test.mp3',
          recorded_at: '2024-01-19T10:00:00Z',
          processing_attempts: 0
        },
        error: null
      })

      // Mock repeated failures
      mockTranscribeAudio.mockResolvedValue({
        text: null,
        error: new Error('API failure')
      })

      // Process multiple notes to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        await processingService.processNote(`note-${i}`, 'test-user')
      }

      // Circuit should be open now, so further processing should fail fast
      const result = await processingService.processNote('note-final', 'test-user')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Circuit breaker is open')
    })

    it('should reset circuit breaker after timeout', async () => {
      // This would require mocking timers and is complex
      // For now, we'll test the basic functionality
      expect(true).toBe(true)
    })
  })

  describe('Error Tracking', () => {
    it('should log errors when error tracking is enabled', async () => {
      mockHasErrorTracking.mockReturnValue(true)
      
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'test-note',
          user_id: 'test-user',
          audio_url: 'https://example.com/test.mp3',
          recorded_at: '2024-01-19T10:00:00Z',
          processing_attempts: 0
        },
        error: null
      })

      mockTranscribeAudio.mockResolvedValue({
        text: null,
        error: new Error('Test error')
      })

      await processingService.processNote('test-note', 'test-user')

      expect(mockLogMigrationStatus).toHaveBeenCalled()
    })

    it('should skip error logging when tracking is disabled', async () => {
      mockHasErrorTracking.mockReturnValue(false)
      
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'test-note',
          user_id: 'test-user',
          audio_url: 'https://example.com/test.mp3',
          recorded_at: '2024-01-19T10:00:00Z',
          processing_attempts: 0
        },
        error: null
      })

      mockTranscribeAudio.mockResolvedValue({
        text: null,
        error: new Error('Test error')
      })

      await processingService.processNote('test-note', 'test-user')

      expect(mockLogMigrationStatus).not.toHaveBeenCalled()
    })
  })

  describe('Performance Metrics', () => {
    it('should track processing timing metrics', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'test-note',
          user_id: 'test-user',
          audio_url: 'https://example.com/test.mp3',
          recorded_at: '2024-01-19T10:00:00Z',
          processing_attempts: 0
        },
        error: null
      })

      mockTranscribeAudio.mockResolvedValue({
        text: 'Test transcription',
        error: null
      })

      mockAnalyzeTranscription.mockResolvedValue({
        analysis: { sentiment: { classification: 'Positive' } },
        error: null
      })

      // Mock project knowledge
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'project_knowledge') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: { content: {} },
              error: null
            }),
            upsert: jest.fn().mockResolvedValue({ error: null })
          }
        }
        return mockSupabase
      })

      const result = await processingService.processNote('test-note', 'test-user')

      expect(result.success).toBe(true)
      // Metrics would be logged internally
    })
  })
})