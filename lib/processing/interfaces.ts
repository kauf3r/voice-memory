/**
 * Processing Pipeline Interfaces - Type Definitions for the Refactored Architecture
 */

export interface ProcessingJob {
  queue_id: string
  note_id: string
  user_id: string
  audio_url: string
  priority: number
  attempts: number
  recorded_at: string
}

export interface ProcessingResult {
  success: boolean
  error?: string
  warning?: string
  transcription?: string
  analysis?: any
  noteId?: string
}

export interface ProcessingMetrics {
  startTime: number
  endTime?: number
  transcriptionTime?: number
  analysisTime?: number
  totalTime?: number
  attempts: number
  errorCategory?: string
  processingStage?: ProcessingStage
}

export type ProcessingStage = 
  | 'initialization' 
  | 'lock_acquisition'
  | 'transcription' 
  | 'analysis' 
  | 'saving' 
  | 'completed'
  | 'failed'

export interface ProcessingContext {
  noteId: string
  userId: string
  job: ProcessingJob
  metrics: ProcessingMetrics
  forceReprocess?: boolean
}

export interface ProcessingStep {
  name: string
  stage: ProcessingStage
  execute(context: ProcessingContext): Promise<ProcessingStepResult>
  rollback?(context: ProcessingContext): Promise<void>
  canSkip?(context: ProcessingContext): Promise<boolean>
}

export interface ProcessingStepResult {
  success: boolean
  data?: any
  error?: string
  warning?: string
  skipRemaining?: boolean
}

export interface CircuitBreakerConfig {
  failureThreshold: number
  timeoutMs: number
  resetTimeoutMs: number
}

export interface ProcessingConfig {
  timeoutMinutes: number
  maxAttempts: number
  batchSize: number
  retryDelayMs: number
  circuitBreaker: CircuitBreakerConfig
}

export interface AudioProcessingResult {
  transcription: string
  duration?: number
  language?: string
}

export interface AnalysisResult {
  analysis: any
  warning?: string
  knowledgeUpdates?: string[]
}

export interface ErrorClassification {
  category: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  retryable: boolean
  retryDelayMs?: number
}

export interface SystemHealthMetrics {
  circuitBreaker: {
    isOpen: boolean
    failures: number
    errorTypes: Record<string, number>
    lastFailureTime: number
  }
  summary: {
    totalProcessed: number
    totalSuccessful: number
    totalFailed: number
    successRate: number
    averageProcessingTime: number
    errorCategoryBreakdown: Record<string, number>
    currentlyProcessing: number
    uptime: number
  }
  stuckNotes: string[]
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
  timestamp: string
}

export interface ProcessingServiceInterface {
  processNote(noteId: string, userId?: string, forceReprocess?: boolean): Promise<ProcessingResult>
  processNextBatch(batchSize?: number): Promise<BatchProcessingResult>
  getProcessingStats(userId: string): Promise<ProcessingStats>
  resetStuckProcessing(forceReset?: boolean): Promise<{ reset: number }>
  getSystemHealthMetrics(): Promise<SystemHealthMetrics>
}

export interface BatchProcessingResult {
  processed: number
  failed: number
  errors: string[]
  metrics?: {
    totalTime: number
    averageProcessingTime: number
    successRate: number
    errorBreakdown: Record<string, number>
  }
}

export interface ProcessingStats {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
}

export interface LockManager {
  acquireLock(noteId: string, timeoutMinutes?: number): Promise<boolean>
  releaseLock(noteId: string): Promise<void>
  releaseLockWithError(noteId: string, error: string): Promise<void>
  cleanupAbandonedLocks(timeoutMinutes?: number): Promise<number>
}

export interface AudioProcessor {
  processAudio(audioData: Buffer, mimeType: string, noteId: string): Promise<AudioProcessingResult>
  transcribe(audioFile: File): Promise<{ text: string; error?: Error }>
}

export interface AnalysisProcessor {
  analyze(transcription: string, context: string, recordedAt: string): Promise<AnalysisResult>
}

export interface MetricsCollector {
  recordProcessingStart(noteId: string): ProcessingMetrics
  recordProcessingComplete(noteId: string, success: boolean, result?: any): void
  recordProcessingStage(noteId: string, stage: ProcessingStage, duration?: number): void
  recordError(noteId: string, error: string, category: string): void
  getMetrics(noteId: string): ProcessingMetrics | undefined
  getSummaryMetrics(): any
}

export interface ErrorHandler {
  classifyError(error: Error | string): ErrorClassification
  shouldRetry(classification: ErrorClassification, attempts: number): boolean
  getRetryDelay(classification: ErrorClassification, attempts: number): number
  logError(context: ProcessingContext, error: Error | string): void
}

// Event system for processing pipeline monitoring
export interface ProcessingEvent {
  type: 'processing_started' | 'processing_completed' | 'processing_failed' | 'stage_changed'
  noteId: string
  timestamp: Date
  data?: any
}

export interface ProcessingEventListener {
  onEvent(event: ProcessingEvent): void | Promise<void>
}