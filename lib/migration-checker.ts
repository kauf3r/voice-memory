import { createServiceClient } from './supabase-server'

export interface MigrationCheckResult {
  isApplied: boolean
  hasErrorTracking: boolean
  hasProcessingErrors: boolean
  hasRateLimits: boolean
  hasFunctions: boolean
  errors: string[]
}

let migrationCheckCache: MigrationCheckResult | null = null
let lastCheckTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Check if the error tracking migration has been applied
 * Uses caching to avoid repeated database calls
 */
export async function checkErrorTrackingMigration(): Promise<MigrationCheckResult> {
  const now = Date.now()
  
  // Return cached result if still valid
  if (migrationCheckCache && (now - lastCheckTime) < CACHE_DURATION) {
    return migrationCheckCache
  }

  const supabase = createServiceClient()
  const result: MigrationCheckResult = {
    isApplied: false,
    hasErrorTracking: false,
    hasProcessingErrors: false,
    hasRateLimits: false,
    hasFunctions: false,
    errors: []
  }

  try {
    // Quick test for error tracking columns
    const { data: testNote } = await supabase
      .from('notes')
      .select('id')
      .limit(1)
      .single()

    if (testNote) {
      // Test error tracking columns
      const { error: columnError } = await supabase
        .from('notes')
        .update({
          error_message: 'migration_check_test',
          processing_attempts: 0,
          last_error_at: new Date().toISOString()
        })
        .eq('id', testNote.id)

      if (!columnError) {
        result.hasErrorTracking = true
        
        // Clean up test
        await supabase
          .from('notes')
          .update({
            error_message: null,
            processing_attempts: null,
            last_error_at: null
          })
          .eq('id', testNote.id)
      } else {
        result.errors.push(`Error tracking columns: ${columnError.message}`)
      }

      // Test processing_errors table
      const { error: tableError } = await supabase
        .from('processing_errors')
        .select('id')
        .limit(1)

      if (!tableError) {
        result.hasProcessingErrors = true
      } else {
        result.errors.push(`processing_errors table: ${tableError.message}`)
      }

      // Test rate_limits table
      const { error: rateError } = await supabase
        .from('rate_limits')
        .select('service')
        .limit(1)

      if (!rateError) {
        result.hasRateLimits = true
      } else {
        result.errors.push(`rate_limits table: ${rateError.message}`)
      }

      // Test functions
      const { error: functionError } = await supabase
        .rpc('get_processing_stats', { 
          p_user_id: '00000000-0000-0000-0000-000000000000' 
        })

      if (!functionError) {
        result.hasFunctions = true
      } else {
        result.errors.push(`Database functions: ${functionError.message}`)
      }
    } else {
      result.errors.push('No notes found to test with')
    }

    // Determine overall status
    result.isApplied = result.hasErrorTracking && 
                      result.hasProcessingErrors && 
                      result.hasRateLimits && 
                      result.hasFunctions

  } catch (error) {
    result.errors.push(`Migration check failed: ${error}`)
  }

  // Cache the result
  migrationCheckCache = result
  lastCheckTime = now

  return result
}

/**
 * Clear the migration check cache (useful for testing or after migrations)
 */
export function clearMigrationCheckCache(): void {
  migrationCheckCache = null
  lastCheckTime = 0
}

/**
 * Get a simple boolean indicating if error tracking is available
 */
export async function hasErrorTracking(): Promise<boolean> {
  const result = await checkErrorTrackingMigration()
  return result.isApplied
}

/**
 * Log migration status to console (useful for debugging)
 */
export async function logMigrationStatus(): Promise<void> {
  const result = await checkErrorTrackingMigration()
  
  if (result.isApplied) {
    console.log('✅ Error tracking migration is applied')
  } else {
    console.log('❌ Error tracking migration is not applied')
    if (result.errors.length > 0) {
      console.log('Errors:', result.errors)
    }
  }
} 