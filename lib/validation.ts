import { z } from 'zod'
// Schema structure mirrors types.ts NoteAnalysis - validated at runtime

/**
 * Zod schemas aligned with lib/types.ts NoteAnalysis interface
 *
 * IMPORTANT: These schemas MUST match the TypeScript types in types.ts
 * The prompt in analysis.ts produces output matching these schemas.
 */

// Task urgency and domain enums (match types.ts)
const TaskUrgencySchema = z.enum(['NOW', 'SOON', 'LATER'])
const TaskDomainSchema = z.enum(['WORK', 'PERS', 'PROJ'])
const MoodSchema = z.enum(['positive', 'neutral', 'negative'])

// V2 ADHD analysis enums
const EnergySchema = z.enum(['low', 'medium', 'high'])
const TaskContextSchema = z.enum(['desk', 'phone', 'errand'])
const NoteTypeSchema = z.enum(['brain_dump', 'meeting_debrief', 'planning', 'venting', 'idea_capture'])
const OpenLoopTypeSchema = z.enum(['decision', 'waiting_for'])

// AnalysisTask schema (matches types.ts AnalysisTask)
const AnalysisTaskSchema = z.object({
  title: z.string(),
  urgency: TaskUrgencySchema,
  domain: TaskDomainSchema,
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
  context: z.string().optional(),
  // V2 ADHD analysis fields (optional for backwards compatibility)
  estimatedMinutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(120)]).optional(),
  energy: EnergySchema.optional(),
  taskContext: TaskContextSchema.optional(),
})

// V2 OpenLoop schema
const OpenLoopSchema = z.object({
  type: OpenLoopTypeSchema,
  description: z.string(),
})

// V2 theOneThing schema - supports both V1 (string) and V2 (object) formats
const TheOneThingSchema = z.union([
  z.string(),
  z.object({
    task: z.string(),
    why: z.string(),
  })
]).nullable()

// DraftMessage schema (matches types.ts DraftMessage)
const DraftMessageSchema = z.object({
  recipient: z.string(),
  subject: z.string(),
  body: z.string(),
})

// MentionedPerson schema (matches types.ts MentionedPerson)
const MentionedPersonSchema = z.object({
  name: z.string(),
  context: z.string(),
  relationship: z.string().optional(),
})

// Main NoteAnalysis schema - MUST match types.ts NoteAnalysis interface
// The structure is validated at runtime; ValidatedAnalysis type is inferred from schema
export const AnalysisSchema = z.object({
  summary: z.string(),
  mood: MoodSchema,
  topic: z.string(),
  theOneThing: TheOneThingSchema,
  tasks: z.array(AnalysisTaskSchema).default([]),
  draftMessages: z.array(DraftMessageSchema).default([]),
  people: z.array(MentionedPersonSchema).default([]),
  recordedAt: z.string(),
  // V2 ADHD analysis fields (optional for backwards compatibility)
  openLoops: z.array(OpenLoopSchema).optional().default([]),
  noteType: NoteTypeSchema.optional(),
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

// Helper type for raw analysis data (matches simplified NoteAnalysis structure)
interface RawAnalysisData {
  summary?: unknown
  mood?: unknown
  topic?: unknown
  theOneThing?: unknown
  tasks?: unknown[]
  draftMessages?: unknown[]
  people?: unknown[]
  recordedAt?: unknown
  // V2 fields
  openLoops?: unknown[]
  noteType?: unknown
}

// Create a partial analysis with fallback values - matches simplified NoteAnalysis
function createPartialAnalysis(rawAnalysis: unknown): ValidatedAnalysis {
  const raw = rawAnalysis as RawAnalysisData

  return {
    summary: typeof raw?.summary === 'string' ? raw.summary : 'Analysis incomplete',
    mood: ['positive', 'neutral', 'negative'].includes(raw?.mood as string)
      ? (raw.mood as 'positive' | 'neutral' | 'negative')
      : 'neutral',
    topic: typeof raw?.topic === 'string' ? raw.topic : 'General',
    // V2 supports both string and object formats for theOneThing
    theOneThing: typeof raw?.theOneThing === 'string'
      ? raw.theOneThing
      : (raw?.theOneThing && typeof raw.theOneThing === 'object' &&
         typeof (raw.theOneThing as Record<string, unknown>).task === 'string' &&
         typeof (raw.theOneThing as Record<string, unknown>).why === 'string')
        ? { task: (raw.theOneThing as Record<string, unknown>).task as string, why: (raw.theOneThing as Record<string, unknown>).why as string }
        : null,
    tasks: Array.isArray(raw?.tasks)
      ? raw.tasks
          .filter((t): t is Record<string, unknown> =>
            t !== null &&
            typeof t === 'object' &&
            typeof (t as Record<string, unknown>).title === 'string' &&
            ['NOW', 'SOON', 'LATER'].includes((t as Record<string, unknown>).urgency as string) &&
            ['WORK', 'PERS', 'PROJ'].includes((t as Record<string, unknown>).domain as string)
          )
          .map(t => ({
            title: t.title as string,
            urgency: t.urgency as 'NOW' | 'SOON' | 'LATER',
            domain: t.domain as 'WORK' | 'PERS' | 'PROJ',
            dueDate: typeof t.dueDate === 'string' ? t.dueDate : undefined,
            assignedTo: typeof t.assignedTo === 'string' ? t.assignedTo : undefined,
            context: typeof t.context === 'string' ? t.context : undefined,
            // V2 ADHD fields - permissively accept if valid
            estimatedMinutes: [15, 30, 60, 120].includes(t.estimatedMinutes as number) ? t.estimatedMinutes as 15 | 30 | 60 | 120 : undefined,
            energy: ['low', 'medium', 'high'].includes(t.energy as string) ? t.energy as 'low' | 'medium' | 'high' : undefined,
            taskContext: ['desk', 'phone', 'errand'].includes(t.taskContext as string) ? t.taskContext as 'desk' | 'phone' | 'errand' : undefined,
          }))
      : [],
    draftMessages: Array.isArray(raw?.draftMessages)
      ? raw.draftMessages
          .filter((m): m is Record<string, unknown> =>
            m !== null &&
            typeof m === 'object' &&
            typeof (m as Record<string, unknown>).recipient === 'string' &&
            typeof (m as Record<string, unknown>).subject === 'string' &&
            typeof (m as Record<string, unknown>).body === 'string'
          )
          .map(m => ({
            recipient: m.recipient as string,
            subject: m.subject as string,
            body: m.body as string,
          }))
      : [],
    people: Array.isArray(raw?.people)
      ? raw.people
          .filter((p): p is Record<string, unknown> =>
            p !== null &&
            typeof p === 'object' &&
            typeof (p as Record<string, unknown>).name === 'string' &&
            typeof (p as Record<string, unknown>).context === 'string'
          )
          .map(p => ({
            name: p.name as string,
            context: p.context as string,
            relationship: typeof p.relationship === 'string' ? p.relationship : undefined,
          }))
      : [],
    recordedAt: typeof raw?.recordedAt === 'string'
      ? raw.recordedAt
      : new Date().toISOString(),
    // V2 fields - permissively default to empty/undefined if missing
    openLoops: Array.isArray(raw?.openLoops)
      ? raw.openLoops
          .filter((loop): loop is Record<string, unknown> =>
            loop !== null &&
            typeof loop === 'object' &&
            ['decision', 'waiting_for'].includes((loop as Record<string, unknown>).type as string) &&
            typeof (loop as Record<string, unknown>).description === 'string'
          )
          .map(loop => ({
            type: loop.type as 'decision' | 'waiting_for',
            description: loop.description as string,
          }))
      : [],
    noteType: ['brain_dump', 'meeting_debrief', 'planning', 'venting', 'idea_capture'].includes(raw?.noteType as string)
      ? raw.noteType as 'brain_dump' | 'meeting_debrief' | 'planning' | 'venting' | 'idea_capture'
      : undefined,
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