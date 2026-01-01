/**
 * Knowledge Services Index
 * Export all knowledge-related services and types
 */

// Main service
export { KnowledgeService } from './KnowledgeService'

// Supporting services
export { AuthenticationService } from './AuthenticationService'
export { NotesDataService } from './NotesDataService'
export { ProjectKnowledgeService } from './ProjectKnowledgeService'
export { KnowledgeAggregatorService } from './KnowledgeAggregatorService'
export { TaskStateService } from './TaskStateService'

// Utilities
export { AggregationHelpers } from './AggregationHelpers'
export { CacheManager } from './CacheManager'
export { ErrorHandler } from './ErrorHandler'

// Types
export * from './KnowledgeTypes'

// Re-export commonly used interfaces
export type {
  TaskState,
  TaskStateFilter,
  PinTaskParams,
  CompleteTaskParams,
  TaskStats
} from './TaskStateService'

export type {
  ProjectKnowledge
} from './ProjectKnowledgeService'

export type {
  ServiceError
} from './ErrorHandler'