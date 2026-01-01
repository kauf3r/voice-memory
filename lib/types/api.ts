/**
 * Common API types used across the application
 */

// Error handling types
export type ErrorType = 
  | 'validation' 
  | 'authentication' 
  | 'authorization' 
  | 'rate_limit'
  | 'server_error'
  | 'network_error'
  | 'timeout'
  | 'openai_error'
  | 'storage_error'
  | 'database_error'
  | 'processing_error'
  | 'unknown'

export interface ErrorResponse {
  error: string
  type: ErrorType
  details?: string
  code?: string
  timestamp: string
  requestId?: string
  usage?: UsageInfo
  limits?: RateLimitInfo
}

export interface UsageInfo {
  used: number
  limit: number
  reset?: string
}

export interface RateLimitInfo {
  remaining: number
  reset: string
  limit: number
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  metadata?: ResponseMetadata
}

export interface ResponseMetadata {
  timestamp: string
  version?: string
  requestId?: string
}

// Pagination types
export interface PaginationParams {
  limit?: number
  offset?: number
  cursor?: string
}

export interface PaginationResponse {
  total: number
  limit: number
  offset: number
  hasMore: boolean
  nextCursor?: string
}

// Stats API types
export interface StatsResponse {
  stats: SystemStats
  timestamp: string
}

export interface SystemStats {
  totalNotes: number
  processedNotes: number
  pendingNotes: number
  failedNotes: number
  totalTasks: number
  completedTasks: number
  averageProcessingTime?: number
  storageUsed?: number
  lastProcessedAt?: string
}

// Performance API types
export interface PerformanceMetrics {
  endpoint: string
  method: string
  avgDuration: number
  p95Duration: number
  p99Duration: number
  errorRate: number
  requestCount: number
}

export interface PerformanceAggregation {
  [endpoint: string]: {
    totalRequests: number
    totalDuration: number
    errorCount: number
    durations: number[]
  }
}

// Background job types
export type JobType = 
  | 'batch_processing' 
  | 'cleanup' 
  | 'analytics' 
  | 'maintenance' 
  | 'migration'

export type JobStatus = 
  | 'pending' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'cancelled'

export interface BackgroundJob {
  id: string
  type: JobType
  status: JobStatus
  payload: Record<string, unknown>
  priority: number
  scheduledAt: Date
  startedAt?: Date
  completedAt?: Date
  error?: string
  attempts: number
  maxAttempts: number
}

// Analysis types (extending existing types)
export interface AnalysisTask {
  task: string
  priority?: 'high' | 'medium' | 'low'
  dueDate?: string
  assignee?: string
}

export interface AnalysisMessage {
  recipient: string
  subject?: string
  content: string
  urgency?: 'immediate' | 'soon' | 'later'
}

export interface AnalysisOutreach {
  person: string
  reason: string
  method?: string
  timing?: string
}

export interface ExtendedAnalysis {
  sentiment?: string
  topics?: string[]
  tasks?: {
    myTasks?: AnalysisTask[]
    delegatedTasks?: AnalysisTask[]
  }
  ideas?: string[]
  messagesToDraft?: AnalysisMessage[]
  crossReferences?: string[]
  outreachIdeas?: AnalysisOutreach[]
  [key: string]: unknown // For additional fields
}