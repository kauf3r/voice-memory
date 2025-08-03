import { 
  validateAnalysis, 
  AnalysisSchema,
  CreateNoteSchema,
  UpdateNoteSchema 
} from '@/lib/validation'

describe('Validation Module', () => {
  
  describe('AnalysisSchema', () => {
    const validAnalysis = {
      sentiment: {
        classification: 'Positive',
        explanation: 'This is a positive sentiment'
      },
      focusTopics: {
        primary: 'Main Topic',
        minor: ['Topic 1', 'Topic 2']
      },
      tasks: {
        myTasks: ['Task 1', 'Task 2'],
        delegatedTasks: [{
          task: 'Delegated task',
          assignedTo: 'John Doe',
          nextSteps: 'Follow up next week'
        }]
      },
      keyIdeas: ['Key idea 1', 'Key idea 2'],
      messagesToDraft: [{
        recipient: 'test@example.com',
        subject: 'Test subject',
        body: 'Test message body'
      }],
      crossReferences: {
        relatedNotes: ['note-1', 'note-2'],
        projectKnowledgeUpdates: ['update-1']
      },
      outreachIdeas: [{
        contact: 'Contact Name',
        topic: 'Topic',
        purpose: 'Purpose'
      }],
      structuredData: {
        dates: [{
          date: '2024-01-20',
          context: 'Meeting date',
          type: 'meeting'
        }],
        times: [{
          time: '2:00 PM',
          context: 'Meeting time',
          type: 'meeting'
        }],
        locations: [{
          place: 'Conference Room A',
          context: 'Meeting location',
          type: 'meeting_place'
        }],
        numbers: [{
          value: '$10,000',
          context: 'Budget amount',
          type: 'price'
        }],
        people: [{
          name: 'John Doe',
          context: 'Project manager',
          relationship: 'colleague'
        }]
      },
      recordingContext: {
        recordedAt: '2024-01-19T14:00:00Z',
        extractedDate: '2024-01-19',
        timeReferences: ['today', 'next week']
      }
    }

    it('should validate complete valid analysis', () => {
      const result = AnalysisSchema.safeParse(validAnalysis)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sentiment.classification).toBe('Positive')
        expect(result.data.focusTopics.primary).toBe('Main Topic')
        expect(result.data.tasks.myTasks).toHaveLength(2)
      }
    })

    it('should validate with minimal required fields', () => {
      const minimalAnalysis = {
        sentiment: {
          classification: 'Neutral',
          explanation: 'Neutral explanation'
        },
        focusTopics: {
          primary: 'Topic',
          minor: ['Minor 1', 'Minor 2']
        },
        tasks: {
          myTasks: [],
          delegatedTasks: []
        },
        keyIdeas: [],
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
          recordedAt: '2024-01-19T14:00:00Z',
          timeReferences: []
        }
      }

      const result = AnalysisSchema.safeParse(minimalAnalysis)
      
      expect(result.success).toBe(true)
    })

    it('should reject invalid sentiment classification', () => {
      const invalidAnalysis = {
        ...validAnalysis,
        sentiment: {
          classification: 'Invalid',
          explanation: 'Test'
        }
      }

      const result = AnalysisSchema.safeParse(invalidAnalysis)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['sentiment', 'classification'])
        expect(result.error.errors[0].code).toBe('invalid_enum_value')
      }
    })

    it('should reject invalid minor topics array length', () => {
      const invalidAnalysis = {
        ...validAnalysis,
        focusTopics: {
          primary: 'Topic',
          minor: ['Only one topic']
        }
      }

      const result = AnalysisSchema.safeParse(invalidAnalysis)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['focusTopics', 'minor'])
        expect(result.error.errors[0].code).toBe('too_small')
      }
    })

    it('should reject too many minor topics', () => {
      const invalidAnalysis = {
        ...validAnalysis,
        focusTopics: {
          primary: 'Topic',
          minor: ['Topic 1', 'Topic 2', 'Topic 3']
        }
      }

      const result = AnalysisSchema.safeParse(invalidAnalysis)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].path).toEqual(['focusTopics', 'minor'])
        expect(result.error.errors[0].code).toBe('too_big')
      }
    })

    it('should validate delegated task structure', () => {
      const validTask = {
        task: 'Complete project',
        assignedTo: 'John',
        nextSteps: 'Review by Friday'
      }

      const analysisWithTask = {
        ...validAnalysis,
        tasks: {
          myTasks: [],
          delegatedTasks: [validTask]
        }
      }

      const result = AnalysisSchema.safeParse(analysisWithTask)
      
      expect(result.success).toBe(true)
    })

    it('should reject incomplete delegated task', () => {
      const incompleteTask = {
        task: 'Complete project',
        // Missing assignedTo and nextSteps
      }

      const analysisWithIncompleteTask = {
        ...validAnalysis,
        tasks: {
          myTasks: [],
          delegatedTasks: [incompleteTask]
        }
      }

      const result = AnalysisSchema.safeParse(analysisWithIncompleteTask)
      
      expect(result.success).toBe(false)
    })

    it('should validate message structure', () => {
      const validMessage = {
        recipient: 'colleague@example.com',
        subject: 'Project Update',
        body: 'Here is the project update'
      }

      const analysisWithMessage = {
        ...validAnalysis,
        messagesToDraft: [validMessage]
      }

      const result = AnalysisSchema.safeParse(analysisWithMessage)
      
      expect(result.success).toBe(true)
    })

    it('should validate structured data types', () => {
      const analysisWithStructuredData = {
        ...validAnalysis,
        structuredData: {
          dates: [{
            date: '2024-01-20',
            context: 'Meeting',
            type: 'deadline'
          }],
          times: [{
            time: '3:00 PM',
            context: 'Call',
            type: 'general'
          }],
          locations: [{
            place: 'Office',
            context: 'Work location',
            type: 'destination'
          }],
          numbers: [{
            value: '100',
            context: 'Quantity',
            type: 'quantity'
          }],
          people: [{
            name: 'Jane Smith',
            context: 'Team lead'
          }]
        }
      }

      const result = AnalysisSchema.safeParse(analysisWithStructuredData)
      
      expect(result.success).toBe(true)
    })

    it('should reject invalid structured data types', () => {
      const analysisWithInvalidType = {
        ...validAnalysis,
        structuredData: {
          ...validAnalysis.structuredData,
          dates: [{
            date: '2024-01-20',
            context: 'Meeting',
            type: 'invalid_type' // Invalid enum value
          }]
        }
      }

      const result = AnalysisSchema.safeParse(analysisWithInvalidType)
      
      expect(result.success).toBe(false)
    })

    it('should handle optional fields correctly', () => {
      const analysisWithOptionalFields = {
        ...validAnalysis,
        recordingContext: {
          recordedAt: '2024-01-19T14:00:00Z',
          // extractedDate is optional
          timeReferences: ['today']
        }
      }

      const result = AnalysisSchema.safeParse(analysisWithOptionalFields)
      
      expect(result.success).toBe(true)
    })
  })

  describe('validateAnalysis function', () => {
    const validAnalysis = {
      sentiment: {
        classification: 'Positive',
        explanation: 'Positive sentiment'
      },
      focusTopics: {
        primary: 'Main Topic',
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
        recordedAt: '2024-01-19T14:00:00Z',
        timeReferences: []
      }
    }

    it('should validate correct analysis structure', () => {
      const result = validateAnalysis(validAnalysis)
      
      expect(result.error).toBeNull()
      expect(result.analysis).toEqual(validAnalysis)
    })

    it('should handle invalid analysis with partial recovery', () => {
      const invalidAnalysis = {
        sentiment: {
          classification: 'Invalid', // Invalid enum value
          explanation: 'Test explanation'
        },
        focusTopics: {
          primary: 'Valid Topic',
          minor: ['Topic 1', 'Topic 2']
        },
        // Missing other required fields
      }

      const result = validateAnalysis(invalidAnalysis)
      
      // Should create partial analysis
      expect(result.analysis).not.toBeNull()
      expect(result.error).toContain('Partial validation')
      expect(result.analysis?.sentiment.classification).toBe('Neutral') // Fallback value
      expect(result.analysis?.focusTopics.primary).toBe('Valid Topic')
    })

    it('should handle completely invalid data', () => {
      const invalidData = 'not an object'

      const result = validateAnalysis(invalidData)
      
      expect(result.analysis).toBeNull()
      expect(result.error).toContain('Validation failed')
    })

    it('should handle null/undefined input', () => {
      const result1 = validateAnalysis(null)
      const result2 = validateAnalysis(undefined)
      
      expect(result1.analysis).toBeNull()
      expect(result1.error).toContain('Validation failed')
      
      expect(result2.analysis).toBeNull()
      expect(result2.error).toContain('Validation failed')
    })

    it('should handle partial data with missing required fields', () => {
      const partialAnalysis = {
        sentiment: {
          classification: 'Positive',
          explanation: 'Test'
        }
        // Missing all other required fields
      }

      const result = validateAnalysis(partialAnalysis)
      
      // Should create partial analysis with defaults
      expect(result.analysis).not.toBeNull()
      expect(result.error).toContain('Partial validation')
      expect(result.analysis?.sentiment.classification).toBe('Positive')
      expect(result.analysis?.focusTopics.primary).toBe('General') // Default value
      expect(result.analysis?.focusTopics.minor).toEqual(['Topic1', 'Topic2']) // Default values
    })

    it('should handle arrays with invalid items', () => {
      const analysisWithInvalidArray = {
        ...validAnalysis,
        tasks: {
          myTasks: ['Valid task', 123, null, 'Another valid task'], // Mixed types
          delegatedTasks: []
        }
      }

      const result = validateAnalysis(analysisWithInvalidArray)
      
      // Should filter out invalid items
      expect(result.analysis).not.toBeNull()
      expect(result.analysis?.tasks.myTasks).toEqual(['Valid task', 'Another valid task'])
    })

    it('should handle invalid minor topics array in partial recovery', () => {
      const analysisWithInvalidMinor = {
        ...validAnalysis,
        focusTopics: {
          primary: 'Valid Topic',
          minor: ['Only one'] // Should have 2 items
        }
      }

      const result = validateAnalysis(analysisWithInvalidMinor)
      
      // Should create partial analysis with fallback minor topics
      expect(result.analysis).not.toBeNull()
      expect(result.error).toContain('Partial validation')
      expect(result.analysis?.focusTopics.minor).toEqual(['Topic1', 'Topic2'])
    })

    it('should preserve valid delegated tasks and filter invalid ones', () => {
      const analysisWithMixedTasks = {
        ...validAnalysis,
        tasks: {
          myTasks: [],
          delegatedTasks: [
            {
              task: 'Valid task',
              assignedTo: 'John',
              nextSteps: 'Follow up'
            },
            {
              task: 'Invalid task',
              // Missing assignedTo and nextSteps
            },
            {
              task: 'Another valid task',
              assignedTo: 'Jane',
              nextSteps: 'Review'
            }
          ]
        }
      }

      const result = validateAnalysis(analysisWithMixedTasks)
      
      expect(result.analysis).not.toBeNull()
      expect(result.analysis?.tasks.delegatedTasks).toHaveLength(2)
      expect(result.analysis?.tasks.delegatedTasks[0].task).toBe('Valid task')
      expect(result.analysis?.tasks.delegatedTasks[1].task).toBe('Another valid task')
    })
  })

  describe('CreateNoteSchema', () => {
    it('should validate valid note creation data', () => {
      const validData = {
        audio_url: 'https://example.com/audio.mp3',
        duration_seconds: 120,
        transcription: 'Test transcription',
      }

      const result = CreateNoteSchema.safeParse(validData)
      
      expect(result.success).toBe(true)
    })

    it('should validate minimal note creation data', () => {
      const minimalData = {
        audio_url: 'https://example.com/audio.mp3'
      }

      const result = CreateNoteSchema.safeParse(minimalData)
      
      expect(result.success).toBe(true)
    })

    it('should reject invalid URL', () => {
      const invalidData = {
        audio_url: 'not-a-url'
      }

      const result = CreateNoteSchema.safeParse(invalidData)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].code).toBe('invalid_url')
      }
    })

    it('should reject negative duration', () => {
      const invalidData = {
        audio_url: 'https://example.com/audio.mp3',
        duration_seconds: -10
      }

      const result = CreateNoteSchema.safeParse(invalidData)
      
      expect(result.success).toBe(false)
    })

    it('should reject non-integer duration', () => {
      const invalidData = {
        audio_url: 'https://example.com/audio.mp3',
        duration_seconds: 10.5
      }

      const result = CreateNoteSchema.safeParse(invalidData)
      
      expect(result.success).toBe(false)
    })
  })

  describe('UpdateNoteSchema', () => {
    it('should validate valid update data', () => {
      const validData = {
        transcription: 'Updated transcription',
        analysis: { sentiment: 'positive' },
        processed_at: '2024-01-19T14:00:00Z'
      }

      const result = UpdateNoteSchema.safeParse(validData)
      
      expect(result.success).toBe(true)
    })

    it('should validate partial update data', () => {
      const partialData = {
        transcription: 'Only transcription update'
      }

      const result = UpdateNoteSchema.safeParse(partialData)
      
      expect(result.success).toBe(true)
    })

    it('should validate empty update data', () => {
      const emptyData = {}

      const result = UpdateNoteSchema.safeParse(emptyData)
      
      expect(result.success).toBe(true)
    })

    it('should reject invalid datetime format', () => {
      const invalidData = {
        processed_at: 'not-a-datetime'
      }

      const result = UpdateNoteSchema.safeParse(invalidData)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.errors[0].code).toBe('invalid_string')
      }
    })

    it('should accept any analysis format', () => {
      const dataWithAnalysis = {
        analysis: {
          custom: 'format',
          nested: {
            data: 'value'
          },
          array: [1, 2, 3]
        }
      }

      const result = UpdateNoteSchema.safeParse(dataWithAnalysis)
      
      expect(result.success).toBe(true)
    })
  })
})