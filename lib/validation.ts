import { z } from 'zod'

// Enhanced task schema for v2 analysis
const EnhancedTaskSchema = z.object({
  description: z.string(),
  priority: z.enum(['High', 'Medium', 'Low']).optional(),
  effort: z.enum(['Quick', 'Medium', 'Complex']).optional(),
  dueDate: z.string().optional(),
  context: z.string().optional(),
  dependencies: z.array(z.string()).default([])
})

const EnhancedDelegatedTaskSchema = z.object({
  task: z.string(),
  assignedTo: z.string(),
  relationship: z.string().optional(),
  nextSteps: z.string(),
  successCriteria: z.string().optional(),
  priority: z.enum(['High', 'Medium', 'Low']).optional()
})

// Enhanced idea schema
const EnhancedIdeaSchema = z.object({
  concept: z.string(),
  impact: z.string().optional(),
  feasibility: z.string().optional(),
  novelty: z.string().optional(),
  connections: z.array(z.string()).default([])
})

// Enhanced message schema
const EnhancedMessageSchema = z.object({
  recipient: z.string(),
  relationship: z.string().optional(),
  subject: z.string(),
  body: z.string(),
  tone: z.enum(['professional', 'casual', 'formal']).optional(),
  urgency: z.enum(['high', 'medium', 'low']).optional(),
  callToAction: z.string().optional()
})

// Enhanced cross-reference schemas
const EnhancedRelatedNoteSchema = z.object({
  reference: z.string(),
  relevance: z.number().min(0).max(1).optional(),
  connectionType: z.enum(['continuation', 'update', 'related']).optional(),
  significance: z.string().optional()
})

const EnhancedKnowledgeUpdateSchema = z.object({
  update: z.string(),
  category: z.enum(['contacts', 'projects', 'insights', 'patterns']).optional(),
  confidence: z.number().min(0).max(1).optional()
})

// Enhanced outreach schema
const EnhancedOutreachSchema = z.object({
  contact: z.string(),
  topic: z.string(),
  purpose: z.enum(['collaboration', 'information', 'networking']).optional(),
  value: z.string().optional(),
  timing: z.string().optional(),
  context: z.string().optional()
})

// Enhanced structured data schemas
const EnhancedDateSchema = z.object({
  date: z.string(),
  context: z.string(),
  type: z.enum(['past', 'future', 'deadline', 'meeting', 'event']),
  importance: z.enum(['high', 'medium', 'low']).optional()
})

const EnhancedTimeSchema = z.object({
  time: z.string(),
  context: z.string(),
  type: z.enum(['arrival', 'departure', 'meeting', 'deadline', 'general']),
  precision: z.enum(['exact', 'approximate']).optional()
})

const EnhancedLocationSchema = z.object({
  place: z.string(),
  context: z.string(),
  type: z.enum(['destination', 'origin', 'meeting_place', 'reference']),
  significance: z.string().optional()
})

const EnhancedNumberSchema = z.object({
  value: z.string(),
  context: z.string(),
  type: z.enum(['quantity', 'measurement', 'price', 'duration', 'identifier']),
  unit: z.string().optional()
})

const EnhancedPersonSchema = z.object({
  name: z.string(),
  context: z.string(),
  relationship: z.string().optional(),
  importance: z.enum(['high', 'medium', 'low']).optional()
})

// Analysis metadata schema
const AnalysisMetadataSchema = z.object({
  version: z.string().default('2.0'),
  model: z.string(),
  processingTime: z.string().optional(),
  overallConfidence: z.number().min(0).max(1).default(0.8),
  complexityScore: z.number().min(0).max(1).default(0.5),
  qualityFlags: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([])
})

// Enhanced analysis schema with backward compatibility
export const AnalysisSchema = z.object({
  sentiment: z.object({
    classification: z.enum(['Positive', 'Neutral', 'Negative']),
    explanation: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    nuances: z.array(z.string()).default([]),
    energyLevel: z.enum(['high', 'medium', 'low']).optional(),
    moodProgression: z.string().optional()
  }),
  focusTopics: z.object({
    primary: z.string(),
    minor: z.array(z.string()).min(2).max(2),
    relevanceScores: z.array(z.number().min(0).max(1)).optional(),
    domainClassification: z.string().optional(),
    topicRelationships: z.array(z.string()).default([])
  }),
  tasks: z.object({
    // Support both old and new task formats
    myTasks: z.union([
      z.array(z.string()), // Legacy format
      z.array(EnhancedTaskSchema) // New format
    ]).default([]),
    delegatedTasks: z.union([
      z.array(z.object({ // Legacy format
        task: z.string(),
        assignedTo: z.string(),
        nextSteps: z.string(),
      })),
      z.array(EnhancedDelegatedTaskSchema) // New format
    ]).default([]),
  }),
  keyIdeas: z.union([
    z.array(z.string()), // Legacy format
    z.array(EnhancedIdeaSchema) // New format
  ]).default([]),
  messagesToDraft: z.union([
    z.array(z.object({ // Legacy format
      recipient: z.string(),
      subject: z.string(),
      body: z.string(),
    })),
    z.array(EnhancedMessageSchema) // New format
  ]).default([]),
  crossReferences: z.object({
    relatedNotes: z.union([
      z.array(z.string()), // Legacy format
      z.array(EnhancedRelatedNoteSchema) // New format
    ]).default([]),
    projectKnowledgeUpdates: z.union([
      z.array(z.string()), // Legacy format
      z.array(EnhancedKnowledgeUpdateSchema) // New format
    ]).default([]),
  }),
  outreachIdeas: z.union([
    z.array(z.object({ // Legacy format
      contact: z.string(),
      topic: z.string(),
      purpose: z.string(),
    })),
    z.array(EnhancedOutreachSchema) // New format
  ]).default([]),
  structuredData: z.object({
    dates: z.union([
      z.array(z.object({ // Legacy format
        date: z.string(),
        context: z.string(),
        type: z.enum(['past', 'future', 'deadline', 'meeting', 'event']),
      })),
      z.array(EnhancedDateSchema) // New format
    ]).default([]),
    times: z.union([
      z.array(z.object({ // Legacy format
        time: z.string(),
        context: z.string(),
        type: z.enum(['arrival', 'departure', 'meeting', 'deadline', 'general']),
      })),
      z.array(EnhancedTimeSchema) // New format
    ]).default([]),
    locations: z.union([
      z.array(z.object({ // Legacy format
        place: z.string(),
        context: z.string(),
        type: z.enum(['destination', 'origin', 'meeting_place', 'reference']),
      })),
      z.array(EnhancedLocationSchema) // New format
    ]).default([]),
    numbers: z.union([
      z.array(z.object({ // Legacy format
        value: z.string(),
        context: z.string(),
        type: z.enum(['quantity', 'measurement', 'price', 'duration', 'identifier']),
      })),
      z.array(EnhancedNumberSchema) // New format
    ]).default([]),
    people: z.union([
      z.array(z.object({ // Legacy format
        name: z.string(),
        context: z.string(),
        relationship: z.string().optional(),
      })),
      z.array(EnhancedPersonSchema) // New format
    ]).default([]),
  }),
  recordingContext: z.object({
    recordedAt: z.string(),
    extractedDate: z.string().optional(),
    timeReferences: z.array(z.string()).default([]),
    contextualClues: z.array(z.string()).default([])
  }),
  // New metadata field for enhanced analysis
  analysisMetadata: AnalysisMetadataSchema.optional()
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

// Enhanced partial analysis creation with support for both legacy and new formats
function createPartialAnalysis(rawAnalysis: unknown): ValidatedAnalysis {
  const raw = rawAnalysis as any
  
  // Helper function to normalize tasks to legacy format for consistency
  function normalizeTasks(tasks: any[]): any[] {
    return tasks.map((task: any) => {
      if (typeof task === 'string') {
        return task // Legacy string format
      } else if (task && typeof task.description === 'string') {
        return task.description // Extract description from enhanced format
      } else if (task && typeof task.task === 'string') {
        return task.task // Handle delegated task format
      }
      return task
    }).filter((task: any) => typeof task === 'string' && task.length > 0)
  }
  
  // Helper function to normalize ideas
  function normalizeIdeas(ideas: any[]): any[] {
    return ideas.map((idea: any) => {
      if (typeof idea === 'string') {
        return idea // Legacy string format
      } else if (idea && typeof idea.concept === 'string') {
        return idea.concept // Extract concept from enhanced format
      }
      return idea
    }).filter((idea: any) => typeof idea === 'string' && idea.length > 0)
  }
  
  return {
    sentiment: {
      classification: ['Positive', 'Neutral', 'Negative'].includes(raw?.sentiment?.classification) 
        ? raw.sentiment.classification as 'Positive' | 'Neutral' | 'Negative'
        : 'Neutral',
      explanation: typeof raw?.sentiment?.explanation === 'string' 
        ? raw.sentiment.explanation 
        : 'Analysis incomplete',
      confidence: typeof raw?.sentiment?.confidence === 'number' 
        ? raw.sentiment.confidence 
        : undefined,
      nuances: Array.isArray(raw?.sentiment?.nuances) 
        ? raw.sentiment.nuances.filter((n: any) => typeof n === 'string')
        : [],
      energyLevel: ['high', 'medium', 'low'].includes(raw?.sentiment?.energyLevel)
        ? raw.sentiment.energyLevel
        : undefined,
      moodProgression: typeof raw?.sentiment?.moodProgression === 'string'
        ? raw.sentiment.moodProgression
        : undefined
    },
    focusTopics: {
      primary: typeof raw?.focusTopics?.primary === 'string' 
        ? raw.focusTopics.primary 
        : 'General',
      minor: Array.isArray(raw?.focusTopics?.minor) && raw.focusTopics.minor.length >= 2
        ? [raw.focusTopics.minor[0], raw.focusTopics.minor[1]]
        : ['Topic1', 'Topic2'],
      relevanceScores: Array.isArray(raw?.focusTopics?.relevanceScores)
        ? raw.focusTopics.relevanceScores.filter((score: any) => typeof score === 'number')
        : undefined,
      domainClassification: typeof raw?.focusTopics?.domainClassification === 'string'
        ? raw.focusTopics.domainClassification
        : undefined,
      topicRelationships: Array.isArray(raw?.focusTopics?.topicRelationships)
        ? raw.focusTopics.topicRelationships.filter((rel: any) => typeof rel === 'string')
        : []
    },
    tasks: {
      myTasks: Array.isArray(raw?.tasks?.myTasks) 
        ? normalizeTasks(raw.tasks.myTasks)
        : [],
      delegatedTasks: Array.isArray(raw?.tasks?.delegatedTasks)
        ? raw.tasks.delegatedTasks.filter((t: any) => {
            // Support both legacy and enhanced formats
            if (t && typeof t.task === 'string' && typeof t.assignedTo === 'string') {
              // Ensure nextSteps exists for legacy format
              if (!t.nextSteps) {
                t.nextSteps = 'Follow up required'
              }
              return true
            }
            return false
          })
        : [],
    },
    keyIdeas: Array.isArray(raw?.keyIdeas)
      ? normalizeIdeas(raw.keyIdeas)
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
        ? raw.crossReferences.relatedNotes.map((note: any) => {
            if (typeof note === 'string') {
              return note // Legacy format
            } else if (note && typeof note.reference === 'string') {
              return note.reference // Enhanced format
            }
            return note
          }).filter((note: any) => typeof note === 'string')
        : [],
      projectKnowledgeUpdates: Array.isArray(raw?.crossReferences?.projectKnowledgeUpdates)
        ? raw.crossReferences.projectKnowledgeUpdates.map((update: any) => {
            if (typeof update === 'string') {
              return update // Legacy format
            } else if (update && typeof update.update === 'string') {
              return update.update // Enhanced format
            }
            return update
          }).filter((update: any) => typeof update === 'string')
        : [],
    },
    outreachIdeas: Array.isArray(raw?.outreachIdeas)
      ? raw.outreachIdeas.filter((idea: any) =>
          idea && typeof idea.contact === 'string' &&
          typeof idea.topic === 'string' &&
          (typeof idea.purpose === 'string' || typeof idea.value === 'string') // Support both legacy and new format
        ).map((idea: any) => ({
          contact: idea.contact,
          topic: idea.topic,
          purpose: idea.purpose || idea.value || 'networking' // Fallback for purpose
        }))
      : [],
    structuredData: {
      dates: Array.isArray(raw?.structuredData?.dates)
        ? raw.structuredData.dates.filter((d: any) =>
            d && typeof d.date === 'string' && typeof d.context === 'string' && 
            ['past', 'future', 'deadline', 'meeting', 'event'].includes(d.type)
          )
        : [],
      times: Array.isArray(raw?.structuredData?.times)
        ? raw.structuredData.times.filter((t: any) =>
            t && typeof t.time === 'string' && typeof t.context === 'string' &&
            ['arrival', 'departure', 'meeting', 'deadline', 'general'].includes(t.type)
          )
        : [],
      locations: Array.isArray(raw?.structuredData?.locations)
        ? raw.structuredData.locations.filter((l: any) =>
            l && typeof l.place === 'string' && typeof l.context === 'string' &&
            ['destination', 'origin', 'meeting_place', 'reference'].includes(l.type)
          )
        : [],
      numbers: Array.isArray(raw?.structuredData?.numbers)
        ? raw.structuredData.numbers.filter((n: any) =>
            n && typeof n.value === 'string' && typeof n.context === 'string' &&
            ['quantity', 'measurement', 'price', 'duration', 'identifier'].includes(n.type)
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
      contextualClues: Array.isArray(raw?.recordingContext?.contextualClues)
        ? raw.recordingContext.contextualClues.filter((clue: any) => typeof clue === 'string')
        : []
    },
    // Include analysis metadata if present
    analysisMetadata: raw?.analysisMetadata ? {
      version: raw.analysisMetadata.version || '2.0',
      model: raw.analysisMetadata.model || 'unknown',
      processingTime: raw.analysisMetadata.processingTime,
      overallConfidence: typeof raw.analysisMetadata.overallConfidence === 'number' 
        ? raw.analysisMetadata.overallConfidence 
        : 0.8,
      complexityScore: typeof raw.analysisMetadata.complexityScore === 'number'
        ? raw.analysisMetadata.complexityScore
        : 0.5,
      qualityFlags: Array.isArray(raw.analysisMetadata.qualityFlags)
        ? raw.analysisMetadata.qualityFlags.filter((flag: any) => typeof flag === 'string')
        : [],
      suggestions: Array.isArray(raw.analysisMetadata.suggestions)
        ? raw.analysisMetadata.suggestions.filter((suggestion: any) => typeof suggestion === 'string')
        : []
    } : undefined
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