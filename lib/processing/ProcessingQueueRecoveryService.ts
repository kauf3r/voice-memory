/**
 * Stub ProcessingQueueRecoveryService - No-op implementation
 * Original enterprise recovery system was removed during simplification
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface RecoveryResult {
  success: boolean
  recoveredJobs: number
  failedJobs: number
  skippedJobs: number
  errors: string[]
  details: RecoveryJobDetail[]
}

export interface RecoveryJobDetail {
  noteId: string
  stage: string
  action: 'recovered' | 'failed' | 'skipped'
  reason: string
  attempts: number
}

export interface RecoveryStats {
  totalRecoveries: number
  successfulRecoveries: number
  failedRecoveries: number
  lastRecoveryAt: string | null
}

export class ProcessingQueueRecoveryService {
  constructor(_client: SupabaseClient) {}

  async recoverProcessingQueue(): Promise<RecoveryResult> {
    return {
      success: true,
      recoveredJobs: 0,
      failedJobs: 0,
      skippedJobs: 0,
      errors: [],
      details: []
    }
  }

  async getRecoveryStats(): Promise<RecoveryStats> {
    return {
      totalRecoveries: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      lastRecoveryAt: null
    }
  }
}
