/**
 * Service Validation Script
 * Validates that all services can be imported and instantiated correctly
 */

import {
  KnowledgeService,
  AuthenticationService,
  NotesDataService,
  ProjectKnowledgeService,
  KnowledgeAggregatorService,
  AggregationHelpers,
  CacheManager,
  ErrorHandler,
  type KnowledgeStats,
  type KnowledgeContent,
  type AggregatedKnowledge,
  type KnowledgeResponse,
  type AuthenticationContext,
  type ProcessedNote
} from './index'

/**
 * Validate service imports and basic functionality
 */
export function validateServices(): { success: boolean; errors: string[] } {
  const errors: string[] = []

  try {
    // Check service classes exist
    if (typeof KnowledgeService !== 'function') {
      errors.push('KnowledgeService is not a valid constructor')
    }

    if (typeof AuthenticationService !== 'function') {
      errors.push('AuthenticationService is not a valid class')
    }

    if (typeof NotesDataService !== 'function') {
      errors.push('NotesDataService is not a valid constructor')
    }

    if (typeof ProjectKnowledgeService !== 'function') {
      errors.push('ProjectKnowledgeService is not a valid constructor')
    }

    if (typeof KnowledgeAggregatorService !== 'function') {
      errors.push('KnowledgeAggregatorService is not a valid class')
    }

    // Check utility classes
    if (typeof AggregationHelpers !== 'function') {
      errors.push('AggregationHelpers is not a valid class')
    }

    if (typeof CacheManager !== 'function') {
      errors.push('CacheManager is not a valid class')
    }

    if (typeof ErrorHandler !== 'function') {
      errors.push('ErrorHandler is not a valid class')
    }

    // Check static methods exist
    if (typeof AuthenticationService.authenticateFromHeader !== 'function') {
      errors.push('AuthenticationService.authenticateFromHeader is not a function')
    }

    if (typeof KnowledgeAggregatorService.aggregateFromNotes !== 'function') {
      errors.push('KnowledgeAggregatorService.aggregateFromNotes is not a function')
    }

    if (typeof AggregationHelpers.createEmptyStats !== 'function') {
      errors.push('AggregationHelpers.createEmptyStats is not a function')
    }

    if (typeof CacheManager.createCachedResponse !== 'function') {
      errors.push('CacheManager.createCachedResponse is not a function')
    }

    if (typeof ErrorHandler.handleAuthError !== 'function') {
      errors.push('ErrorHandler.handleAuthError is not a function')
    }

    // Test type availability (compile-time check)
    const testStats: KnowledgeStats = AggregationHelpers.createEmptyStats()
    const testContent: KnowledgeContent = AggregationHelpers.createEmptyContent()

    if (!testStats || !testContent) {
      errors.push('Type instantiation failed')
    }

    console.log('✅ Service validation completed:', {
      success: errors.length === 0,
      errors: errors.length,
      checkedServices: [
        'KnowledgeService',
        'AuthenticationService', 
        'NotesDataService',
        'ProjectKnowledgeService',
        'KnowledgeAggregatorService',
        'AggregationHelpers',
        'CacheManager',
        'ErrorHandler'
      ]
    })

    return {
      success: errors.length === 0,
      errors
    }

  } catch (error) {
    errors.push(`Validation error: ${error.message}`)
    return {
      success: false,
      errors
    }
  }
}

/**
 * Test empty knowledge base creation
 */
export function testEmptyKnowledgeBase(): AggregatedKnowledge {
  const emptyNotes: ProcessedNote[] = []
  const completionMap = new Map()
  
  return KnowledgeAggregatorService.aggregateFromNotes(emptyNotes, completionMap)
}

/**
 * Test aggregation helpers
 */
export function testAggregationHelpers(): boolean {
  try {
    const stats = AggregationHelpers.createEmptyStats()
    const content = AggregationHelpers.createEmptyContent()
    const completionMap = AggregationHelpers.createCompletionMap([])

    return !!(stats && content && completionMap)
  } catch {
    return false
  }
}

/**
 * Test error handler
 */
export function testErrorHandler(): boolean {
  try {
    const error = ErrorHandler.createServiceError('Test error', 'TEST', 500)
    const isRetryable = ErrorHandler.isRetryableError(new Error('connection failed'))
    
    return !!(error && typeof isRetryable === 'boolean')
  } catch {
    return false
  }
}

// Export validation function for external use
export default validateServices