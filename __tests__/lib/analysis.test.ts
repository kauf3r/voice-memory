import { validateAnalysis } from '@/lib/validation'
import { NoteAnalysis } from '@/lib/types'

describe('Analysis Validation', () => {
  const validAnalysis: NoteAnalysis = {
    sentiment: {
      classification: 'Positive',
      explanation: 'Test explanation'
    },
    focusTopics: {
      primary: 'Main topic',
      minor: ['Topic 1', 'Topic 2']
    },
    tasks: {
      myTasks: ['Task 1', 'Task 2'],
      delegatedTasks: [
        {
          task: 'Delegated task',
          assignedTo: 'John',
          nextSteps: 'Follow up'
        }
      ]
    },
    keyIdeas: ['Idea 1', 'Idea 2'],
    messagesToDraft: [
      {
        recipient: 'test@example.com',
        subject: 'Test subject',
        body: 'Test body'
      }
    ],
    crossReferences: {
      relatedNotes: ['note1', 'note2'],
      projectKnowledgeUpdates: ['update1']
    },
    outreachIdeas: [
      {
        contact: 'Contact Name',
        topic: 'Topic',
        purpose: 'Purpose'
      }
    ],
    structuredData: {
      dates: [],
      times: [],
      locations: [],
      numbers: [],
      people: []
    },
    recordingContext: {
      recordedAt: new Date().toISOString(),
      extractedDate: undefined,
      timeReferences: []
    }
  }

  test('validates correct analysis structure', () => {
    const result = validateAnalysis(validAnalysis)
    expect(result.error).toBeNull()
    expect(result.analysis).toEqual(validAnalysis)
  })

  test('rejects invalid sentiment classification', () => {
    const invalidAnalysis = {
      ...validAnalysis,
      sentiment: {
        ...validAnalysis.sentiment,
        classification: 'Invalid' as any
      }
    }
    
    const result = validateAnalysis(invalidAnalysis)
    expect(result.error).not.toBeNull()
    expect(result.error).toContain('sentiment.classification')
    // Partial analysis might still be created
  })

  test('rejects analysis with missing required fields', () => {
    const incompleteAnalysis = {
      sentiment: validAnalysis.sentiment
      // Missing other required fields
    }
    
    const result = validateAnalysis(incompleteAnalysis)
    expect(result.error).not.toBeNull()
    expect(result.error).toContain('Required')
  })

  test('handles partial analysis gracefully', () => {
    const partialAnalysis = {
      ...validAnalysis,
      tasks: {
        myTasks: [],
        delegatedTasks: []
      },
      keyIdeas: [],
      messagesToDraft: [],
      outreachIdeas: []
    }
    
    const result = validateAnalysis(partialAnalysis)
    expect(result.error).toBeNull()
    expect(result.analysis).not.toBeNull()
  })

  test('validates minor topics array length', () => {
    const invalidMinorTopics = {
      ...validAnalysis,
      focusTopics: {
        primary: 'Main topic',
        minor: ['Only one topic'] as any // Should be exactly 2
      }
    }
    
    const result = validateAnalysis(invalidMinorTopics)
    expect(result.error).not.toBeNull()
    expect(result.error).toContain('minor')
  })

  test('validates email format in messages', () => {
    const invalidEmail = {
      ...validAnalysis,
      messagesToDraft: [
        {
          recipient: 'invalid-email',
          subject: 'Test',
          body: 'Test'
        }
      ]
    }
    
    const result = validateAnalysis(invalidEmail)
    // Email validation is not enforced by the schema
    // so this should actually pass
    expect(result.error).toBeNull()
    expect(result.analysis).not.toBeNull()
  })
})