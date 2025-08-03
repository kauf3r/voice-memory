import { z } from 'zod'

// Zod schema for validating GPT-4 analysis results - Match the flat structure from analysis.ts
export const AnalysisSchema = z.object({
  sentiment: z.object({
    classification: z.enum(['Positive', 'Neutral', 'Negative']),
    explanation: z.string(),
  }),
  focusTopics: z.object({
    primary: z.string(),
    minor: z.array(z.string()).min(2).max(2),
  }),
  tasks: z.object({
    myTasks: z.array(z.string()).default([]),
    delegatedTasks: z.array(z.object({
      task: z.string(),
      assignedTo: z.string(),
      nextSteps: z.string(),
    })).default([]),
  }),
  keyIdeas: z.array(z.string()).default([]),
  messagesToDraft: z.array(z.object({
    recipient: z.string(),
    subject: z.string(),
    body: z.string(),
  })).default([]),
  crossReferences: z.object({
    relatedNotes: z.array(z.string()).default([]),
    projectKnowledgeUpdates: z.array(z.string()).default([]),
  }),
  outreachIdeas: z.array(z.object({
    contact: z.string(),
    topic: z.string(),
    purpose: z.string(),
  })).default([]),
  structuredData: z.object({
    dates: z.array(z.object({
      date: z.string(),
      context: z.string(),
      type: z.enum(['past', 'future', 'deadline', 'meeting', 'event']),
    })).default([]),
    times: z.array(z.object({
      time: z.string(),
      context: z.string(),
      type: z.enum(['arrival', 'departure', 'meeting', 'deadline', 'general']),
    })).default([]),
    locations: z.array(z.object({
      place: z.string(),
      context: z.string(),
      type: z.enum(['destination', 'origin', 'meeting_place', 'reference']),
    })).default([]),
    numbers: z.array(z.object({
      value: z.string(),
      context: z.string(),
      type: z.enum(['quantity', 'measurement', 'price', 'duration', 'identifier']),
    })).default([]),
    people: z.array(z.object({
      name: z.string(),
      context: z.string(),
      relationship: z.string().optional(),
    })).default([]),
  }),
  recordingContext: z.object({
    recordedAt: z.string(),
    extractedDate: z.string().optional(),
    timeReferences: z.array(z.string()).default([]),
  }),
})

export type ValidatedAnalysis = z.infer<typeof AnalysisSchema>

// Function to validate and sanitize analysis results
export function validateAnalysis(rawAnalysis: unknown): {
  analysis: ValidatedAnalysis | null
  error: string | null
} {
  try {
    const analysis = AnalysisSchema.parse(rawAnalysis)
    return { analysis, error: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join('; ')
      
      console.error('Analysis validation failed:', errorMessages)
      
      // Try to create a partial analysis with what we can salvage
      try {
        const partialAnalysis = createPartialAnalysis(rawAnalysis)
        return { 
          analysis: partialAnalysis, 
          error: `Partial validation: ${errorMessages}` 
        }
      } catch (partialError) {
        return { 
          analysis: null, 
          error: `Validation failed: ${errorMessages}` 
        }
      }
    }
    
    return { 
      analysis: null, 
      error: 'Unknown validation error' 
    }
  }
}

// Helper type for unknown analysis structure
interface RawAnalysisData {
  sentiment?: {
    classification?: unknown
    explanation?: unknown
  }
  focusTopics?: {
    primary?: unknown
    minor?: unknown
  }
  tasks?: {
    myTasks?: unknown
    delegatedTasks?: unknown
  }
  keyIdeas?: unknown
  messagesToDraft?: unknown
  crossReferences?: {
    relatedNotes?: unknown
    projectKnowledgeUpdates?: unknown
  }
  outreachIdeas?: unknown
  structuredData?: {
    dates?: unknown
    times?: unknown
    locations?: unknown
    numbers?: unknown
    people?: unknown
  }
  recordingContext?: {
    recordedAt?: unknown
    extractedDate?: unknown
    timeReferences?: unknown
  }
}

// Create a partial analysis with fallback values - now matching flat structure
function createPartialAnalysis(rawAnalysis: unknown): ValidatedAnalysis {
  const raw = rawAnalysis as RawAnalysisData
  
  return {
    sentiment: {
      classification: ['Positive', 'Neutral', 'Negative'].includes(raw?.sentiment?.classification) 
        ? raw.sentiment.classification as 'Positive' | 'Neutral' | 'Negative'
        : 'Neutral',
      explanation: typeof raw?.sentiment?.explanation === 'string' 
        ? raw.sentiment.explanation 
        : 'Analysis incomplete',
    },
    focusTopics: {
      primary: typeof raw?.focusTopics?.primary === 'string' 
        ? raw.focusTopics.primary 
        : 'General',
      minor: Array.isArray(raw?.focusTopics?.minor) && raw.focusTopics.minor.length >= 2
        ? [raw.focusTopics.minor[0], raw.focusTopics.minor[1]]
        : ['Topic1', 'Topic2'],
    },
    tasks: {
      myTasks: Array.isArray(raw?.tasks?.myTasks) 
        ? raw.tasks.myTasks.filter((t) => typeof t === 'string' && t.length > 0)
        : [],
      delegatedTasks: Array.isArray(raw?.tasks?.delegatedTasks)
        ? raw.tasks.delegatedTasks.filter((t) => 
            t && typeof t.task === 'string' && 
            typeof t.assignedTo === 'string' && 
            typeof t.nextSteps === 'string'
          )
        : [],
    },
    keyIdeas: Array.isArray(raw?.keyIdeas)
      ? raw.keyIdeas.filter((idea) => typeof idea === 'string' && idea.length > 0)
      : [],
    messagesToDraft: Array.isArray(raw?.messagesToDraft)
      ? raw.messagesToDraft.filter((msg) =>
          msg && typeof msg.recipient === 'string' &&
          typeof msg.subject === 'string' &&
          typeof msg.body === 'string'
        )
      : [],
    crossReferences: {
      relatedNotes: Array.isArray(raw?.crossReferences?.relatedNotes)
        ? raw.crossReferences.relatedNotes.filter((note) => typeof note === 'string')
        : [],
      projectKnowledgeUpdates: Array.isArray(raw?.crossReferences?.projectKnowledgeUpdates)
        ? raw.crossReferences.projectKnowledgeUpdates.filter((update) => typeof update === 'string')
        : [],
    },
    outreachIdeas: Array.isArray(raw?.outreachIdeas)
      ? raw.outreachIdeas.filter((idea) =>
          idea && typeof idea.contact === 'string' &&
          typeof idea.topic === 'string' &&
          typeof idea.purpose === 'string'
        )
      : [],
    structuredData: {
      dates: Array.isArray(raw?.structuredData?.dates)
        ? raw.structuredData.dates.filter((d) =>
            d && typeof d.date === 'string' && typeof d.context === 'string'
          )
        : [],
      times: Array.isArray(raw?.structuredData?.times)
        ? raw.structuredData.times.filter((t) =>
            t && typeof t.time === 'string' && typeof t.context === 'string'
          )
        : [],
      locations: Array.isArray(raw?.structuredData?.locations)
        ? raw.structuredData.locations.filter((l) =>
            l && typeof l.place === 'string' && typeof l.context === 'string'
          )
        : [],
      numbers: Array.isArray(raw?.structuredData?.numbers)
        ? raw.structuredData.numbers.filter((n) =>
            n && typeof n.value === 'string' && typeof n.context === 'string'
          )
        : [],
      people: Array.isArray(raw?.structuredData?.people)
        ? raw.structuredData.people.filter((p) =>
            p && typeof p.name === 'string' && typeof p.context === 'string'
          )
        : [],
    },
    recordingContext: {
      recordedAt: typeof raw?.recordingContext?.recordedAt === 'string'
        ? raw.recordingContext.recordedAt
        : new Date().toISOString(),
      extractedDate: typeof raw?.recordingContext?.extractedDate === 'string'
        ? raw.recordingContext.extractedDate
        : undefined,
      timeReferences: Array.isArray(raw?.recordingContext?.timeReferences)
        ? raw.recordingContext.timeReferences.filter((ref) => typeof ref === 'string')
        : [],
    },
  }
}

// Validation for note creation
export const CreateNoteSchema = z.object({
  audio_url: z.string().url(),
  duration_seconds: z.number().int().positive().optional(),
  transcription: z.string().optional(),
  analysis: z.unknown().optional(),
})

export type CreateNoteData = z.infer<typeof CreateNoteSchema>

// Validation for note updates
export const UpdateNoteSchema = z.object({
  transcription: z.string().optional(),
  analysis: z.unknown().optional(),
  processed_at: z.string().datetime().optional(),
})

export type UpdateNoteData = z.infer<typeof UpdateNoteSchema>