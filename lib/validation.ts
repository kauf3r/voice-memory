import { z } from 'zod'

// Zod schema for validating GPT-4 analysis results - More flexible validation
export const AnalysisSchema = z.object({
  sentiment: z.object({
    classification: z.enum(['Positive', 'Neutral', 'Negative']),
    explanation: z.string().min(1).optional(),
  }).optional(),
  focusTopics: z.object({
    primary: z.string().min(1),
    minor: z.array(z.string().min(1)).min(0).max(5).default([]), // Allow 0-5 minor topics
  }).optional(),
  tasks: z.object({
    myTasks: z.array(z.string().min(1)).default([]),
    delegatedTasks: z.array(z.object({
      task: z.string().min(1),
      assignedTo: z.string().min(1).optional(),
      nextSteps: z.string().min(1).optional(),
    })).default([]),
  }).optional(),
  keyIdeas: z.array(z.string().min(1)).default([]),
  messagesToDraft: z.array(z.object({
    recipient: z.string().min(1),
    subject: z.string().min(1),
    body: z.string().min(1),
  })).default([]),
  crossReferences: z.object({
    relatedNotes: z.array(z.string().min(1)).default([]),
    projectKnowledgeUpdates: z.array(z.string().min(1)).default([]),
  }).optional(),
  outreachIdeas: z.array(z.object({
    contact: z.string().min(1),
    topic: z.string().min(1),
    purpose: z.string().min(1),
  })).default([]),
  structuredData: z.object({
    dates: z.array(z.object({
      date: z.string().min(1),
      context: z.string().min(1),
      type: z.enum(['past', 'future', 'deadline', 'meeting', 'event']),
    })).default([]),
    times: z.array(z.object({
      time: z.string().min(1),
      context: z.string().min(1),
      type: z.enum(['arrival', 'departure', 'meeting', 'deadline', 'general']),
    })).default([]),
    locations: z.array(z.object({
      place: z.string().min(1),
      context: z.string().min(1),
      type: z.enum(['destination', 'origin', 'meeting_place', 'reference']),
    })).default([]),
    numbers: z.array(z.object({
      value: z.string().min(1),
      context: z.string().min(1),
      type: z.enum(['quantity', 'measurement', 'price', 'duration', 'identifier']),
    })).default([]),
    people: z.array(z.object({
      name: z.string().min(1),
      context: z.string().min(1),
      relationship: z.string().optional(),
    })).default([]),
  }).default({
    dates: [],
    times: [],
    locations: [],
    numbers: [],
    people: []
  }),
  recordingContext: z.object({
    recordedAt: z.string().min(1),
    extractedDate: z.string().optional(),
    timeReferences: z.array(z.string()).default([]),
  }).default({
    recordedAt: new Date().toISOString(),
    timeReferences: []
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

// Create a partial analysis with fallback values
function createPartialAnalysis(rawAnalysis: unknown): ValidatedAnalysis {
  const raw = rawAnalysis as any
  
  return {
    sentiment: {
      classification: ['Positive', 'Neutral', 'Negative'].includes(raw?.sentiment?.classification) 
        ? raw.sentiment.classification 
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
        ? raw.focusTopics.minor.slice(0, 2)
        : ['Topic1', 'Topic2'],
    },
    tasks: {
      myTasks: Array.isArray(raw?.tasks?.myTasks) 
        ? raw.tasks.myTasks.filter((t: any) => typeof t === 'string' && t.length > 0)
        : [],
      delegatedTasks: Array.isArray(raw?.tasks?.delegatedTasks)
        ? raw.tasks.delegatedTasks.filter((t: any) => 
            t && typeof t.task === 'string' && 
            typeof t.assignedTo === 'string' && 
            typeof t.nextSteps === 'string'
          )
        : [],
    },
    keyIdeas: Array.isArray(raw?.keyIdeas)
      ? raw.keyIdeas.filter((idea: any) => typeof idea === 'string' && idea.length > 0)
      : [],
    messagesToDraft: Array.isArray(raw?.messagesToDraft)
      ? raw.messagesToDraft.filter((msg: any) =>
          msg && typeof msg.recipient === 'string' &&
          typeof msg.subject === 'string' &&
          typeof msg.body === 'string'
        )
      : [],
    crossReferences: {
      relatedNotes: Array.isArray(raw?.crossReferences?.relatedNotes)
        ? raw.crossReferences.relatedNotes.filter((note: any) => typeof note === 'string')
        : [],
      projectKnowledgeUpdates: Array.isArray(raw?.crossReferences?.projectKnowledgeUpdates)
        ? raw.crossReferences.projectKnowledgeUpdates.filter((update: any) => typeof update === 'string')
        : [],
    },
    outreachIdeas: Array.isArray(raw?.outreachIdeas)
      ? raw.outreachIdeas.filter((idea: any) =>
          idea && typeof idea.contact === 'string' &&
          typeof idea.topic === 'string' &&
          typeof idea.purpose === 'string'
        )
      : [],
    structuredData: {
      dates: Array.isArray(raw?.structuredData?.dates)
        ? raw.structuredData.dates.filter((d: any) =>
            d && typeof d.date === 'string' && typeof d.context === 'string'
          )
        : [],
      times: Array.isArray(raw?.structuredData?.times)
        ? raw.structuredData.times.filter((t: any) =>
            t && typeof t.time === 'string' && typeof t.context === 'string'
          )
        : [],
      locations: Array.isArray(raw?.structuredData?.locations)
        ? raw.structuredData.locations.filter((l: any) =>
            l && typeof l.place === 'string' && typeof l.context === 'string'
          )
        : [],
      numbers: Array.isArray(raw?.structuredData?.numbers)
        ? raw.structuredData.numbers.filter((n: any) =>
            n && typeof n.value === 'string' && typeof n.context === 'string'
          )
        : [],
      people: Array.isArray(raw?.structuredData?.people)
        ? raw.structuredData.people.filter((p: any) =>
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
        ? raw.recordingContext.timeReferences.filter((ref: any) => typeof ref === 'string')
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