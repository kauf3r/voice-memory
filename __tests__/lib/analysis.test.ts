import { validateAnalysis } from '@/lib/validation'
import { NoteAnalysis } from '@/lib/types'

describe('Analysis Validation', () => {
  // Valid analysis matching the simplified NoteAnalysis structure from types.ts
  const validAnalysis: NoteAnalysis = {
    summary: 'A test recording about project planning',
    mood: 'positive',
    topic: 'Project Planning',
    theOneThing: 'Complete the dashboard feature',
    tasks: [
      {
        title: 'Build dashboard component',
        urgency: 'NOW',
        domain: 'WORK',
        dueDate: '2026-01-05',
        context: 'Main project deliverable'
      },
      {
        title: 'Review analytics requirements',
        urgency: 'SOON',
        domain: 'WORK',
        assignedTo: 'Sarah',
        context: 'Needs input from team'
      }
    ],
    draftMessages: [
      {
        recipient: 'Chris',
        subject: 'Dashboard Update',
        body: 'Hi Chris, the dashboard is ready for review.'
      }
    ],
    people: [
      {
        name: 'Chris',
        context: 'Stakeholder for dashboard project',
        relationship: 'colleague'
      },
      {
        name: 'Sarah',
        context: 'Assigned analytics review',
        relationship: 'colleague'
      }
    ],
    recordedAt: new Date().toISOString()
  }

  test('validates correct analysis structure', () => {
    const result = validateAnalysis(validAnalysis)
    expect(result.error).toBeNull()
    expect(result.analysis).not.toBeNull()
    expect(result.analysis?.summary).toBe(validAnalysis.summary)
    expect(result.analysis?.mood).toBe(validAnalysis.mood)
    expect(result.analysis?.tasks).toHaveLength(2)
  })

  test('rejects invalid mood value', () => {
    const invalidAnalysis = {
      ...validAnalysis,
      mood: 'excited' as any // Invalid - must be positive/neutral/negative
    }

    const result = validateAnalysis(invalidAnalysis)
    expect(result.error).not.toBeNull()
    expect(result.error).toContain('mood')
  })

  test('rejects analysis with missing required fields', () => {
    const incompleteAnalysis = {
      summary: 'Test summary'
      // Missing: mood, topic, theOneThing, tasks, draftMessages, people, recordedAt
    }

    const result = validateAnalysis(incompleteAnalysis)
    expect(result.error).not.toBeNull()
  })

  test('handles empty arrays gracefully', () => {
    const minimalAnalysis: NoteAnalysis = {
      summary: 'A simple note with no tasks',
      mood: 'neutral',
      topic: 'General',
      theOneThing: null,
      tasks: [],
      draftMessages: [],
      people: [],
      recordedAt: new Date().toISOString()
    }

    const result = validateAnalysis(minimalAnalysis)
    expect(result.error).toBeNull()
    expect(result.analysis).not.toBeNull()
    expect(result.analysis?.tasks).toHaveLength(0)
  })

  test('validates task urgency values', () => {
    const invalidUrgency = {
      ...validAnalysis,
      tasks: [
        {
          title: 'Invalid task',
          urgency: 'ASAP' as any, // Invalid - must be NOW/SOON/LATER
          domain: 'WORK'
        }
      ]
    }

    const result = validateAnalysis(invalidUrgency)
    expect(result.error).not.toBeNull()
    expect(result.error).toContain('urgency')
  })

  test('validates task domain values', () => {
    const invalidDomain = {
      ...validAnalysis,
      tasks: [
        {
          title: 'Invalid task',
          urgency: 'NOW',
          domain: 'BUSINESS' as any // Invalid - must be WORK/PERS/PROJ
        }
      ]
    }

    const result = validateAnalysis(invalidDomain)
    expect(result.error).not.toBeNull()
    expect(result.error).toContain('domain')
  })

  test('allows null theOneThing', () => {
    const noOneThing = {
      ...validAnalysis,
      theOneThing: null
    }

    const result = validateAnalysis(noOneThing)
    expect(result.error).toBeNull()
    expect(result.analysis?.theOneThing).toBeNull()
  })

  test('validates draftMessage structure', () => {
    const invalidMessage = {
      ...validAnalysis,
      draftMessages: [
        {
          recipient: 'Chris',
          // Missing: subject, body
        }
      ]
    }

    const result = validateAnalysis(invalidMessage)
    expect(result.error).not.toBeNull()
  })

  test('validates people structure', () => {
    const invalidPerson = {
      ...validAnalysis,
      people: [
        {
          name: 'Chris'
          // Missing: context
        }
      ]
    }

    const result = validateAnalysis(invalidPerson)
    expect(result.error).not.toBeNull()
  })

  test('creates partial analysis for salvageable data', () => {
    const partiallyValid = {
      summary: 'Valid summary',
      mood: 'positive',
      topic: 'Valid topic',
      // Missing some fields but salvageable
    }

    const result = validateAnalysis(partiallyValid)
    // Should attempt to create partial analysis
    expect(result.analysis).not.toBeNull()
    expect(result.analysis?.summary).toBe('Valid summary')
  })
})
