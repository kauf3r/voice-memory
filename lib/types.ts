export interface User {
  id: string
  email: string
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  audio_url: string
  duration_seconds?: number
  transcription?: string
  analysis?: NoteAnalysis
  recorded_at: string
  processed_at?: string
  created_at: string
  // Error tracking fields
  error_message?: string
  processing_attempts?: number
  last_error_at?: string
  // Processing lock field
  processing_started_at?: string
}

export interface ProcessingError {
  id: string
  note_id: string
  error_message: string
  error_type?: string
  stack_trace?: string
  processing_attempt: number
  created_at: string
}

export interface TaskCompletion {
  id: string
  user_id: string
  task_id: string
  note_id: string
  completed_at: string
  completed_by?: string
  notes?: string
  created_at: string
}

export interface VoiceMemoryTask {
  id: string
  description: string
  type: 'myTasks' | 'delegatedTasks'
  date: string
  noteId: string
  noteContext?: string
  nextSteps?: string
  assignedTo?: string
  completed: boolean
  completedAt?: string
  completedBy?: string
  completionNotes?: string
  pinned?: boolean
  pinnedAt?: string
  // V2 ADHD analysis fields (optional for backwards compatibility)
  estimatedMinutes?: 15 | 30 | 60 | 120
  energy?: 'low' | 'medium' | 'high'
  taskContext?: 'desk' | 'phone' | 'errand'
}

export interface ProcessingResult {
  success: boolean
  error?: string
  warning?: string
  transcription?: string
  analysis?: NoteAnalysis
}

export interface ProcessingStats {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  errorRate?: number
  global_metrics?: SummaryMetrics
}

export interface CircuitBreakerStatus {
  isOpen: boolean
  failures: number
  errorTypes: Record<string, number>
  lastFailureTime: number
}

export interface SummaryMetrics {
  totalProcessed: number
  totalSuccessful: number
  totalFailed: number
  successRate: number
  averageProcessingTime: number
  currentlyProcessing: number
  errorCategoryBreakdown: Record<string, number>
  circuitBreakerStatus: CircuitBreakerStatus
  uptime: number
  lastResetTime: number
  cached: boolean
  timestamp: string
}

export interface RetryRequest {
  action: 'retryStuck' | 'forceReprocess'
  noteIds?: string[]
  forceReset?: boolean
  batchSize?: number
}

// Domain types for task categorization
export type TaskDomain = 'WORK' | 'PERS' | 'PROJ'
export type TaskUrgency = 'NOW' | 'SOON' | 'LATER'
export type Mood = 'positive' | 'neutral' | 'negative'

// Simplified task structure optimized for Trello/ADHD workflows
export interface AnalysisTask {
  title: string           // Short, actionable task title
  urgency: TaskUrgency    // NOW/SOON/LATER for ADHD-friendly prioritization
  domain: TaskDomain      // WORK/PERS/PROJ categorization
  dueDate?: string        // If a due date was mentioned
  assignedTo?: string     // If delegated to someone else
  context?: string        // Brief context from the recording
  // V2 ADHD analysis fields (optional for backwards compatibility)
  estimatedMinutes?: 15 | 30 | 60 | 120  // Time estimate
  energy?: 'low' | 'medium' | 'high'      // Energy level required
  taskContext?: 'desk' | 'phone' | 'errand'  // Where task can be done
}

// Person mentioned in recording
export interface MentionedPerson {
  name: string
  context: string
  relationship?: string
}

// Draft message ready to send
export interface DraftMessage {
  recipient: string
  subject: string
  body: string
}

// Simplified NoteAnalysis - 6 focused categories instead of 17
export interface NoteAnalysis {
  // One-line summary of the recording
  summary: string

  // Quick mood indicator
  mood: Mood

  // Primary topic for quick reference
  topic: string

  // The single most important thing mentioned (ADHD-friendly)
  theOneThing: {
    task: string
    why: string  // One sentence explaining priority
  } | null

  // Tasks extracted with urgency and domain
  tasks: AnalysisTask[]

  // Draft messages ready to send
  draftMessages: DraftMessage[]

  // People mentioned for relationship tracking
  people: MentionedPerson[]

  // Recording timestamp
  recordedAt: string

  // V2 ADHD analysis fields (optional for backwards compatibility)
  openLoops?: Array<{
    type: 'decision' | 'waiting_for'
    description: string
  }>

  noteType?: 'brain_dump' | 'meeting_debrief' | 'planning' | 'venting' | 'idea_capture'
}

// Legacy type aliases for backward compatibility during migration
export type BIBDomain = TaskDomain | 'IDEA'
export type BlockerSeverity = 'critical' | 'moderate' | 'minor'
export type TimeSensitivity = 'urgent' | 'soon' | 'someday'

export interface TheOneThing {
  description: string
  domain: BIBDomain
  whyImportant: string
}

export interface Blocker {
  description: string
  severity: BlockerSeverity
  domain: BIBDomain
  potentialSolutions: string[]
}

export interface Opportunity {
  description: string
  domain: BIBDomain
  timeSensitivity: TimeSensitivity
  nextAction: string
}

export interface SOPCandidate {
  triggerPhrase: string
  processDescription: string
  suggestedTitle: string
  domain: BIBDomain
  confidence: number
}

export interface ProjectKnowledge {
  id: string
  user_id: string
  content: KnowledgeContent
  updated_at: string
}

export interface KnowledgeContent {
  insights?: string[]
  learnings?: string[]
  decisions?: string[]
  questions?: string[]
  patterns?: string[]
  relationships?: string[]
  [key: string]: unknown
}