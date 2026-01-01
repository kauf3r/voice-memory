/**
 * Lock Manager Service - Handles processing locks and cleanup
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { LockManager, ProcessingContext } from './interfaces'
import { createDatabaseService } from '../database/queries'

export class LockManagerService implements LockManager {
  private client: SupabaseClient
  private timeoutMinutes: number

  constructor(client: SupabaseClient, timeoutMinutes: number = 15) {
    this.client = client
    this.timeoutMinutes = timeoutMinutes
  }

  async acquireLock(noteId: string, timeoutMinutes?: number): Promise<boolean> {
    const timeout = timeoutMinutes ?? this.timeoutMinutes
    const dbService = createDatabaseService(this.client)
    
    const result = await dbService.acquireProcessingLock(noteId, timeout)
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to acquire processing lock')
    }
    
    return result.data || false
  }

  async releaseLock(noteId: string): Promise<void> {
    const dbService = createDatabaseService(this.client)
    
    const result = await dbService.releaseProcessingLock(noteId)
    
    if (!result.success) {
      console.error(`Failed to release processing lock for note ${noteId}:`, result.error)
    }
  }

  async releaseLockWithError(noteId: string, error: string): Promise<void> {
    try {
      // Update note with error and clear processing state
      const updateData = {
        processing_started_at: null,
        error_message: error,
        last_error_at: new Date().toISOString()
      }
      
      const { error: updateError } = await this.client
        .from('notes')
        .update(updateData)
        .eq('id', noteId)
        
      if (updateError) {
        console.error(`Failed to release processing lock with error for note ${noteId}:`, updateError)
      }
    } catch (err) {
      console.error(`Failed to release processing lock with error for note ${noteId}:`, err)
    }
  }

  async cleanupAbandonedLocks(timeoutMinutes?: number): Promise<number> {
    const timeout = timeoutMinutes ?? this.timeoutMinutes
    
    try {
      const { data: cleanedCount, error } = await this.client
        .rpc('cleanup_abandoned_processing_locks', { p_timeout_minutes: timeout })

      if (error) {
        console.error('Failed to cleanup abandoned locks:', error)
        return 0
      }

      const count = cleanedCount?.[0]?.cleaned_count || 0
      if (count > 0) {
        console.log(`Cleaned up ${count} abandoned processing locks`)
      }
      return count
    } catch (error) {
      console.error('Error in cleanupAbandonedLocks:', error)
      return 0
    }
  }

  async validateLockStatus(context: ProcessingContext): Promise<boolean> {
    try {
      const { data: note, error } = await this.client
        .from('notes')
        .select('processing_started_at, processing_attempts')
        .eq('id', context.noteId)
        .single()

      if (error || !note) {
        return false
      }

      if (!note.processing_started_at) {
        return false // No lock acquired
      }

      const processingStartTime = new Date(note.processing_started_at).getTime()
      const timeoutMs = this.timeoutMinutes * 60 * 1000
      const elapsedTime = Date.now() - processingStartTime
      
      if (elapsedTime > timeoutMs) {
        await this.releaseLockWithError(context.noteId, `Processing timeout exceeded after ${Math.floor(elapsedTime / 1000)}s`)
        return false
      }

      return true
    } catch (error) {
      console.error('Error validating lock status:', error)
      return false
    }
  }
}