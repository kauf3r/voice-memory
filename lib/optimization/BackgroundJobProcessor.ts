/**
 * Stub BackgroundJobProcessor - No-op implementation
 * Original enterprise batch processing was removed during simplification
 */

import { ProcessingService } from '../processing/ProcessingService'

export interface BackgroundJob {
  id: string
  type: 'batch_processing' | 'cleanup' | 'analytics' | 'maintenance' | 'migration'
  priority: number
  payload: unknown
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  attempts: number
  maxAttempts: number
  createdAt: string
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  error?: string
  result?: unknown
}

export class BackgroundJobProcessor {
  constructor(_processingService: ProcessingService) {}

  start(): void {}
  stop(): void {}

  async addJob(
    _type: BackgroundJob['type'],
    _payload: unknown,
    _priority?: number,
    _scheduledAt?: Date
  ): Promise<string> {
    return `job_${Date.now()}`
  }

  getStats(): { pending: number; running: number; completed: number; failed: number } {
    return { pending: 0, running: 0, completed: 0, failed: 0 }
  }
}
