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

// Domain types for BIB categorization
export type BIBDomain = 'WORK' | 'PERS' | 'PROJ' | 'IDEA'
export type BlockerSeverity = 'critical' | 'moderate' | 'minor'
export type TimeSensitivity = 'urgent' | 'soon' | 'someday'

// BIB Framework types
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
  confidence: number // 0.0 - 1.0
}

export interface NoteAnalysis {
  sentiment: {
    classification: 'Positive' | 'Neutral' | 'Negative'
    explanation: string
  }
  focusTopics: {
    primary: string
    minor: [string, string]
  }
  tasks: {
    myTasks: string[]
    delegatedTasks: Array<{
      task: string
      assignedTo: string
      nextSteps: string
    }>
  }
  keyIdeas: string[]
  messagesToDraft: Array<{
    recipient: string
    subject: string
    body: string
  }>
  crossReferences: {
    relatedNotes: string[]
    projectKnowledgeUpdates: string[]
  }
  outreachIdeas: Array<{
    contact: string
    topic: string
    purpose: string
  }>
  // BIB Framework fields
  theOneThing?: TheOneThing | null
  blockers?: Blocker[]
  opportunities?: Opportunity[]
  sopCandidates?: SOPCandidate[]
  structuredData: {
    dates: Array<{
      date: string
      context: string
      type: 'past' | 'future' | 'deadline' | 'meeting' | 'event'
    }>
    times: Array<{
      time: string
      context: string
      type: 'arrival' | 'departure' | 'meeting' | 'deadline' | 'general'
    }>
    locations: Array<{
      place: string
      context: string
      type: 'destination' | 'origin' | 'meeting_place' | 'reference'
    }>
    numbers: Array<{
      value: string
      context: string
      type: 'quantity' | 'measurement' | 'price' | 'duration' | 'identifier'
    }>
    people: Array<{
      name: string
      context: string
      relationship?: string
    }>
  }
  recordingContext: {
    recordedAt: string
    extractedDate?: string
    timeReferences: string[]
  }
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