/**
 * Type definitions for Knowledge Service operations
 */

export interface KnowledgeStats {
  totalNotes: number
  totalInsights: number
  totalTasks: number
  totalMessages: number
  totalOutreach: number
  completedTasks: number
  taskCompletionRate: number
  sentimentDistribution: {
    positive: number
    neutral: number
    negative: number
  }
  timeRange: {
    earliest: string | null
    latest: string | null
  }
}

export interface KnowledgeContent {
  recentInsights: string[]
  topTopics: Record<string, number>
  keyContacts: Record<string, number>
  commonTasks: Record<string, number>
  allTasks: KnowledgeTask[]
  sentimentTrends: Array<{
    date: string
    sentiment: string
  }>
  knowledgeTimeline: Array<{
    date: string
    type: string
    content: string
    noteId: string
  }>
}

export interface KnowledgeTask {
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
}

export interface AggregatedKnowledge {
  stats: KnowledgeStats
  content: KnowledgeContent
  generatedAt: string
}

export interface KnowledgeResponse {
  success: boolean
  knowledge: {
    stats: KnowledgeStats
    content: KnowledgeContent
    generatedAt: string
    projectKnowledge: Record<string, any>
    lastUpdated: string
  }
}

export interface TaskCompletionInfo {
  completedAt: string
  completedBy: string
  completionNotes: string
}

export interface ProcessedNote {
  id: string
  analysis: any
  transcription?: string
  recorded_at: string
  processed_at?: string
}

export interface AuthenticationContext {
  user: any
  token: string
  dbClient: any
  authMethod: 'service' | 'anon'
}

export interface KnowledgeServiceOptions {
  useCache?: boolean
  includeProjectKnowledge?: boolean
  maxInsights?: number
  maxTimelineItems?: number
  maxSentimentTrends?: number
}