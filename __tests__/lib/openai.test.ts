import { jest } from '@jest/globals'
import { transcribeAudio, analyzeTranscription } from '@/lib/openai'
import OpenAI from 'openai'

// Mock OpenAI
jest.mock('openai')

describe('OpenAI Integration', () => {
  let mockOpenAI: any
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset OpenAI mock to default state
    if (OpenAI.resetMock) {
      OpenAI.resetMock()
    }
    
    mockOpenAI = OpenAI.mockClient || {
      audio: {
        transcriptions: {
          create: jest.fn(),
        },
      },
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    }
  })

  describe('transcribeAudio', () => {
    const mockFile = new File(['test audio content'], 'test.mp3', { 
      type: 'audio/mp3' 
    })

    it('should successfully transcribe audio', async () => {
      const expectedText = 'This is the transcribed text'
      mockOpenAI.audio.transcriptions.create.mockResolvedValue({
        text: expectedText
      })

      const result = await transcribeAudio(mockFile)

      expect(result.text).toBe(expectedText)
      expect(result.error).toBeNull()
      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledWith({
        file: mockFile,
        model: 'whisper-1',
        response_format: 'text',
        language: 'en',
      })
    })

    it('should handle transcription errors gracefully', async () => {
      const error = new Error('Transcription failed')
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(error)

      const result = await transcribeAudio(mockFile)

      expect(result.text).toBeNull()
      expect(result.error).toEqual(error)
    })

    it('should handle rate limit errors with proper message', async () => {
      const rateLimitError = new Error('rate_limit_exceeded')
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(rateLimitError)

      const result = await transcribeAudio(mockFile)

      expect(result.text).toBeNull()
      expect(result.error?.message).toBe('OpenAI rate limit exceeded. Please try again later.')
    })

    it('should handle invalid file errors', async () => {
      const invalidFileError = new Error('invalid_file format')
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(invalidFileError)

      const result = await transcribeAudio(mockFile)

      expect(result.text).toBeNull()
      expect(result.error?.message).toBe('Invalid audio file format.')
    })

    it('should handle file too large errors', async () => {
      const fileTooLargeError = new Error('file_too_large')
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(fileTooLargeError)

      const result = await transcribeAudio(mockFile)

      expect(result.text).toBeNull()
      expect(result.error?.message).toBe('Audio file is too large.')
    })

    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('quota_exceeded')
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(quotaError)

      const result = await transcribeAudio(mockFile)

      expect(result.text).toBeNull()
      expect(result.error?.message).toBe('OpenAI quota exceeded. Please check your account.')
    })

    it('should handle authentication errors', async () => {
      const authError = new Error('authentication failed')
      mockOpenAI.audio.transcriptions.create.mockRejectedValue(authError)

      const result = await transcribeAudio(mockFile)

      expect(result.text).toBeNull()
      expect(result.error?.message).toBe('OpenAI authentication failed. Please check your API key.')
    })
  })

  describe('analyzeTranscription', () => {
    const mockTranscription = 'I need to call John about the project deadline next week'
    const mockProjectKnowledge = 'Project Alpha is due next Friday'
    const mockRecordingDate = '2024-01-19T14:00:00Z'

    const mockValidAnalysis = {
      sentiment: {
        classification: 'Neutral',
        explanation: 'Task-focused content'
      },
      focusTopics: {
        primary: 'Project Management',
        minor: ['Deadlines', 'Communication']
      },
      tasks: {
        myTasks: ['Call John about project deadline'],
        delegatedTasks: []
      },
      keyIdeas: ['Project deadline needs attention'],
      messagesToDraft: [],
      crossReferences: {
        relatedNotes: [],
        projectKnowledgeUpdates: ['Project Alpha deadline discussion']
      },
      outreachIdeas: [{
        contact: 'John',
        topic: 'Project deadline',
        purpose: 'Discuss timeline'
      }],
      structuredData: {
        dates: ['next week'],
        times: [],
        locations: [],
        numbers: [],
        people: ['John']
      },
      recordingContext: {
        recordedAt: mockRecordingDate,
        extractedDate: '2024-01-19',
        timeReferences: ['next week']
      }
    }

    it('should successfully analyze transcription', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockValidAnalysis)
          }
        }]
      })

      const result = await analyzeTranscription(mockTranscription, mockProjectKnowledge, mockRecordingDate)

      expect(result.analysis).toBeTruthy()
      expect(result.error).toBeNull()
      expect(result.analysis?.sentiment.classification).toBe('Neutral')
      expect(result.analysis?.tasks.myTasks).toContain('Call John about project deadline')
      
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert analyst who extracts actionable insights from voice notes. Always return valid JSON.'
          },
          {
            role: 'user',
            content: expect.stringContaining(mockTranscription)
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      })
    })

    it('should handle analysis with markdown code blocks', async () => {
      const responseWithMarkdown = '```json\n' + JSON.stringify(mockValidAnalysis) + '\n```'
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: responseWithMarkdown
          }
        }]
      })

      const result = await analyzeTranscription(mockTranscription)

      expect(result.analysis).toBeTruthy()
      expect(result.error).toBeNull()
      expect(result.analysis?.sentiment.classification).toBe('Neutral')
    })

    it('should handle empty response from GPT-4', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: ''
          }
        }]
      })

      const result = await analyzeTranscription(mockTranscription)

      expect(result.analysis).toBeNull()
      expect(result.error?.message).toBe('Empty response from GPT-4')
    })

    it('should handle invalid JSON response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      })

      const result = await analyzeTranscription(mockTranscription)

      expect(result.analysis).toBeNull()
      expect(result.error?.message).toBe('Invalid JSON response from GPT-4')
    })

    it('should handle analysis validation failures', async () => {
      const invalidAnalysis = {
        sentiment: {
          classification: 'InvalidSentiment' // Invalid enum value
        }
      }

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(invalidAnalysis)
          }
        }]
      })

      const result = await analyzeTranscription(mockTranscription)

      expect(result.analysis).toBeNull()
      expect(result.error?.message).toContain('Analysis validation failed')
    })

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('rate_limit_exceeded')
      mockOpenAI.chat.completions.create.mockRejectedValue(rateLimitError)

      const result = await analyzeTranscription(mockTranscription)

      expect(result.analysis).toBeNull()
      expect(result.error?.message).toBe('OpenAI rate limit exceeded. Please try again later.')
    })

    it('should handle context length errors', async () => {
      const contextError = new Error('context_length exceeded')
      mockOpenAI.chat.completions.create.mockRejectedValue(contextError)

      const result = await analyzeTranscription(mockTranscription)

      expect(result.analysis).toBeNull()
      expect(result.error?.message).toBe('Text too long for analysis.')
    })

    it('should handle quota exceeded errors', async () => {
      const quotaError = new Error('quota_exceeded')
      mockOpenAI.chat.completions.create.mockRejectedValue(quotaError)

      const result = await analyzeTranscription(mockTranscription)

      expect(result.analysis).toBeNull()
      expect(result.error?.message).toBe('OpenAI quota exceeded. Please check your account.')
    })

    it('should handle authentication errors', async () => {
      const authError = new Error('authentication failed')
      mockOpenAI.chat.completions.create.mockRejectedValue(authError)

      const result = await analyzeTranscription(mockTranscription)

      expect(result.analysis).toBeNull()
      expect(result.error?.message).toBe('OpenAI authentication failed. Please check your API key.')
    })

    it('should include project knowledge in analysis prompt', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(mockValidAnalysis)
          }
        }]
      })

      await analyzeTranscription(mockTranscription, mockProjectKnowledge, mockRecordingDate)

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0]
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user')
      
      expect(userMessage.content).toContain(mockTranscription)
      expect(userMessage.content).toContain(mockProjectKnowledge)
      expect(userMessage.content).toContain(mockRecordingDate)
    })

    it('should return warning when validation fixes issues', async () => {
      // Mock an analysis that needs partial fixing
      const partialAnalysis = {
        ...mockValidAnalysis,
        focusTopics: {
          primary: 'Valid Topic',
          minor: ['Only one topic'] // Should have 2 topics
        }
      }

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(partialAnalysis)
          }
        }]
      })

      const result = await analyzeTranscription(mockTranscription)

      // Should still succeed but with a warning
      expect(result.analysis).toBeTruthy()
      expect(result.warning).toBeTruthy()
      expect(result.error).toBeNull()
    })
  })

  describe('Environment Configuration', () => {
    const originalEnv = process.env

    beforeEach(() => {
      jest.resetModules()
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should use custom Whisper model from environment', async () => {
      process.env.OPENAI_WHISPER_MODEL = 'whisper-custom'
      
      // Re-import to pick up new env vars
      const { transcribeAudio: customTranscribeAudio } = await import('@/lib/openai')
      
      const mockFile = new File(['test'], 'test.mp3', { type: 'audio/mp3' })
      mockOpenAI.audio.transcriptions.create.mockResolvedValue({ text: 'test' })

      await customTranscribeAudio(mockFile)

      expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'whisper-custom'
        })
      )
    })

    it('should use custom GPT model from environment', async () => {
      process.env.OPENAI_GPT_MODEL = 'gpt-4-custom'
      
      // Re-import to pick up new env vars
      const { analyzeTranscription: customAnalyzeTranscription } = await import('@/lib/openai')
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              sentiment: { classification: 'Positive', explanation: 'test' },
              focusTopics: { primary: 'test', minor: ['test1', 'test2'] },
              tasks: { myTasks: [], delegatedTasks: [] },
              keyIdeas: [],
              messagesToDraft: [],
              crossReferences: { relatedNotes: [], projectKnowledgeUpdates: [] },
              outreachIdeas: [],
              structuredData: { dates: [], times: [], locations: [], numbers: [], people: [] },
              recordingContext: { recordedAt: '2024-01-01T00:00:00Z', timeReferences: [] }
            })
          }
        }]
      })

      await customAnalyzeTranscription('test transcription')

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-custom'
        })
      )
    })

    it('should throw error when OPENAI_API_KEY is not set', async () => {
      delete process.env.OPENAI_API_KEY
      
      // Mock the OpenAI constructor to throw the expected error
      const OriginalOpenAI = OpenAI as any
      OriginalOpenAI.mockImplementation(() => {
        throw new Error('OPENAI_API_KEY environment variable is not set')
      })

      const { transcribeAudio: noKeyTranscribeAudio } = await import('@/lib/openai')
      
      const mockFile = new File(['test'], 'test.mp3', { type: 'audio/mp3' })
      
      const result = await noKeyTranscribeAudio(mockFile)
      
      expect(result.text).toBeNull()
      expect(result.error?.message).toContain('OPENAI_API_KEY')
    })
  })
})