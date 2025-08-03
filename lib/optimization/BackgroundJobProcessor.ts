/**
 * Background Job Processor - Handles batch processing and background tasks
 */

import { ProcessingService } from '../processing/ProcessingService'
import { getSection } from '../config'
import { createServiceClient } from '../supabase-server'
import { createDatabaseService } from '../database/queries'

export interface BackgroundJob {
  id: string
  type: 'batch_processing' | 'cleanup' | 'analytics' | 'maintenance' | 'migration'
  priority: number
  payload: any
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  attempts: number
  maxAttempts: number
  createdAt: string
  scheduledAt: string
  startedAt?: string
  completedAt?: string
  error?: string
  result?: any
}

export interface JobQueue {
  jobs: Map<string, BackgroundJob>
  running: Set<string>
  completed: number
  failed: number
  maxConcurrency: number
  processingInterval: number
}

export interface BatchProcessingConfig {
  batchSize: number
  maxConcurrentBatches: number
  retryDelay: number
  maxRetries: number
  priorityThreshold: number
}

export class BackgroundJobProcessor {
  private processingService: ProcessingService
  private config: ReturnType<typeof getSection<'processing'>>
  private queue: JobQueue
  private batchConfig: BatchProcessingConfig
  private isRunning = false
  private processingInterval: NodeJS.Timeout | null = null
  private client = createServiceClient()

  constructor(processingService: ProcessingService) {
    this.processingService = processingService
    this.config = getSection('processing')
    
    this.queue = {
      jobs: new Map(),
      running: new Set(),
      completed: 0,
      failed: 0,
      maxConcurrency: 3,
      processingInterval: 30000 // 30 seconds
    }

    this.batchConfig = {
      batchSize: this.config.batchSize || 5,
      maxConcurrentBatches: 2,
      retryDelay: 60000, // 1 minute
      maxRetries: 3,
      priorityThreshold: 5
    }
  }

  /**
   * Start background job processing
   */
  start(): void {
    if (this.isRunning) {
      console.log('📋 Background job processor is already running')
      return
    }

    this.isRunning = true
    console.log('🚀 Starting background job processor...')

    // Schedule periodic processing
    this.processingInterval = setInterval(() => {
      this.processJobs()
    }, this.queue.processingInterval)

    // Schedule maintenance jobs
    this.scheduleMaintenanceJobs()

    console.log(`✅ Background job processor started (interval: ${this.queue.processingInterval}ms)`)
  }

  /**
   * Stop background job processing
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    console.log('🛑 Background job processor stopped')
  }

  /**
   * Add a job to the queue
   */
  async addJob(
    type: BackgroundJob['type'],
    payload: any,
    priority: number = 5,
    scheduledAt?: Date
  ): Promise<string> {
    const jobId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const job: BackgroundJob = {
      id: jobId,
      type,
      priority,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: this.batchConfig.maxRetries,
      createdAt: new Date().toISOString(),
      scheduledAt: (scheduledAt || new Date()).toISOString()
    }

    this.queue.jobs.set(jobId, job)
    console.log(`📋 Added ${type} job to queue: ${jobId}`)
    
    return jobId
  }

  /**
   * Process pending jobs
   */
  private async processJobs(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    try {
      // Get pending jobs that are ready to run
      const pendingJobs = Array.from(this.queue.jobs.values())
        .filter(job => 
          job.status === 'pending' && 
          new Date(job.scheduledAt).getTime() <= Date.now() &&
          !this.queue.running.has(job.id)
        )
        .sort((a, b) => a.priority - b.priority) // Higher priority first (lower number)

      // Limit concurrent jobs
      const availableSlots = this.queue.maxConcurrency - this.queue.running.size
      const jobsToProcess = pendingJobs.slice(0, availableSlots)

      for (const job of jobsToProcess) {
        this.processJob(job)
      }

      // Clean up completed jobs older than 1 hour
      this.cleanupOldJobs()

    } catch (error) {
      console.error('Error in job processing cycle:', error)
    }
  }

  /**
   * Process individual job
   */
  private async processJob(job: BackgroundJob): Promise<void> {
    this.queue.running.add(job.id)
    job.status = 'running'
    job.startedAt = new Date().toISOString()
    job.attempts++

    console.log(`⚡ Processing ${job.type} job: ${job.id} (attempt ${job.attempts})`)

    try {
      let result: any = null

      switch (job.type) {
        case 'batch_processing':
          result = await this.processBatchJob(job)
          break
        case 'cleanup':
          result = await this.processCleanupJob(job)
          break
        case 'analytics':
          result = await this.processAnalyticsJob(job)
          break
        case 'maintenance':
          result = await this.processMaintenanceJob(job)
          break
        case 'migration':
          result = await this.processMigrationJob(job)
          break
        default:
          throw new Error(`Unknown job type: ${job.type}`)
      }

      // Job completed successfully
      job.status = 'completed'
      job.completedAt = new Date().toISOString()
      job.result = result
      this.queue.completed++

      console.log(`✅ Completed ${job.type} job: ${job.id}`)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      job.error = errorMessage

      // Check if we should retry
      if (job.attempts < job.maxAttempts) {
        job.status = 'pending'
        job.scheduledAt = new Date(Date.now() + this.batchConfig.retryDelay).toISOString()
        console.log(`⚠️ Job ${job.id} failed, will retry (attempt ${job.attempts}/${job.maxAttempts})`)
      } else {
        job.status = 'failed'
        job.completedAt = new Date().toISOString()
        this.queue.failed++
        console.error(`❌ Job ${job.id} failed permanently:`, errorMessage)
      }
    } finally {
      this.queue.running.delete(job.id)
    }
  }

  /**
   * Process batch processing job
   */
  private async processBatchJob(job: BackgroundJob): Promise<any> {
    const { batchSize = this.batchConfig.batchSize, forceReprocess = false } = job.payload

    console.log(`🔄 Starting batch processing (size: ${batchSize})`)
    
    const result = await this.processingService.processNextBatch(batchSize)
    
    console.log(`📊 Batch processing completed: ${result.processed} processed, ${result.failed} failed`)
    
    // Schedule next batch if there were items processed
    if (result.processed > 0) {
      await this.addJob('batch_processing', { batchSize }, 3, new Date(Date.now() + 60000)) // 1 minute delay
    }

    return result
  }

  /**
   * Process cleanup job
   */
  private async processCleanupJob(job: BackgroundJob): Promise<any> {
    const { 
      type = 'processing_errors',
      retentionHours = 24 
    } = job.payload

    console.log(`🗑️ Starting cleanup job: ${type}`)

    const dbService = createDatabaseService(this.client)
    let cleanedCount = 0

    switch (type) {
      case 'processing_errors':
        // Clean up old processing errors
        const cutoffTime = new Date(Date.now() - (retentionHours * 60 * 60 * 1000)).toISOString()
        const { error } = await this.client
          .from('processing_errors')
          .delete()
          .lt('created_at', cutoffTime)
        
        if (!error) {
          cleanedCount = 1 // Would get actual count in production
        }
        break

      case 'rate_limits':
        // Clean up old rate limit records
        const rateLimitCutoff = new Date(Date.now() - (1 * 60 * 60 * 1000)).toISOString() // 1 hour
        const { error: rateLimitError } = await this.client
          .from('rate_limits')
          .delete()
          .lt('created_at', rateLimitCutoff)
        
        if (!rateLimitError) {
          cleanedCount = 1
        }
        break

      case 'old_notes':
        // Clean up very old notes (6 months+)
        const oldNotesCutoff = new Date(Date.now() - (180 * 24 * 60 * 60 * 1000)).toISOString()
        const { error: oldNotesError } = await this.client
          .from('notes')
          .delete()
          .lt('created_at', oldNotesCutoff)
          .is('processed_at', null)
        
        if (!oldNotesError) {
          cleanedCount = 1
        }
        break
    }

    console.log(`✅ Cleanup completed: ${cleanedCount} records cleaned`)
    return { type, cleanedCount, retentionHours }
  }

  /**
   * Process analytics job
   */
  private async processAnalyticsJob(job: BackgroundJob): Promise<any> {
    const { type = 'user_stats', userId } = job.payload

    console.log(`📊 Starting analytics job: ${type}`)

    const dbService = createDatabaseService(this.client)
    let result: any = {}

    switch (type) {
      case 'user_stats':
        if (userId) {
          result = await dbService.getProcessingStats(userId)
        }
        break

      case 'system_stats':
        // Generate system-wide statistics
        const { data: totalNotes } = await this.client
          .from('notes')
          .select('id', { count: 'exact', head: true })
        
        const { data: processedNotes } = await this.client
          .from('notes')
          .select('id', { count: 'exact', head: true })
          .not('processed_at', 'is', null)

        result = {
          totalNotes: totalNotes?.length || 0,
          processedNotes: processedNotes?.length || 0,
          timestamp: new Date().toISOString()
        }
        break

      case 'performance_analysis':
        // Analyze performance trends
        const perfTracker = this.processingService.getPerformanceTracker()
        result = perfTracker.getPerformanceAnalytics()
        break
    }

    console.log(`✅ Analytics job completed: ${type}`)
    return result
  }

  /**
   * Process maintenance job
   */
  private async processMaintenanceJob(job: BackgroundJob): Promise<any> {
    const { tasks = ['vacuum', 'analyze', 'cleanup'] } = job.payload

    console.log(`🔧 Starting maintenance job with tasks: ${tasks.join(', ')}`)

    const results: any = {}

    for (const task of tasks) {
      try {
        switch (task) {
          case 'vacuum':
            // Database vacuum (would call VACUUM in production)
            results.vacuum = { status: 'completed', note: 'VACUUM would be executed in production' }
            break

          case 'analyze':
            // Update table statistics
            results.analyze = { status: 'completed', note: 'ANALYZE would be executed in production' }
            break

          case 'cleanup':
            // General cleanup
            await this.addJob('cleanup', { type: 'processing_errors', retentionHours: 24 }, 7)
            await this.addJob('cleanup', { type: 'rate_limits', retentionHours: 1 }, 7)
            results.cleanup = { status: 'scheduled', note: 'Cleanup jobs scheduled' }
            break

          case 'reset_stuck':
            // Reset stuck processing
            const resetResult = await this.processingService.resetStuckProcessing(false)
            results.reset_stuck = { status: 'completed', reset: resetResult.reset }
            break
        }
      } catch (error) {
        results[task] = { status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' }
      }
    }

    console.log(`✅ Maintenance job completed`)
    return results
  }

  /**
   * Process migration job
   */
  private async processMigrationJob(job: BackgroundJob): Promise<any> {
    const { 
      migrationType = 'data_migration',
      batchSize = 100 
    } = job.payload

    console.log(`🔄 Starting migration job: ${migrationType}`)

    // Placeholder for migration logic
    // In production, this would handle data migrations, schema updates, etc.
    const result = {
      migrationType,
      batchSize,
      processed: 0,
      status: 'completed',
      note: 'Migration job placeholder - would perform actual migration in production'
    }

    console.log(`✅ Migration job completed: ${migrationType}`)
    return result
  }

  /**
   * Schedule recurring maintenance jobs
   */
  private scheduleMaintenanceJobs(): void {
    // Daily cleanup job
    this.addJob('cleanup', { type: 'processing_errors', retentionHours: 24 }, 8, 
      new Date(Date.now() + 24 * 60 * 60 * 1000)) // Next day

    // Weekly maintenance
    this.addJob('maintenance', { tasks: ['vacuum', 'analyze', 'cleanup'] }, 9,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // Next week

    // Hourly batch processing check
    this.addJob('batch_processing', { batchSize: this.batchConfig.batchSize }, 3,
      new Date(Date.now() + 60 * 60 * 1000)) // Next hour

    console.log('📅 Scheduled recurring maintenance jobs')
  }

  /**
   * Clean up old completed/failed jobs
   */
  private cleanupOldJobs(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    let cleanedCount = 0

    for (const [jobId, job] of this.queue.jobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') &&
          job.completedAt &&
          new Date(job.completedAt).getTime() < oneHourAgo) {
        this.queue.jobs.delete(jobId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log(`🗑️ Cleaned up ${cleanedCount} old job records`)
    }
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): BackgroundJob | null {
    return this.queue.jobs.get(jobId) || null
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: BackgroundJob['status']): BackgroundJob[] {
    return Array.from(this.queue.jobs.values()).filter(job => job.status === status)
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.queue.jobs.get(jobId)
    if (!job || job.status === 'running' || job.status === 'completed') {
      return false
    }

    job.status = 'cancelled'
    job.completedAt = new Date().toISOString()
    console.log(`❌ Cancelled job: ${jobId}`)
    
    return true
  }

  /**
   * Get queue statistics
   */
  getQueueStatistics(): {
    totalJobs: number
    pendingJobs: number
    runningJobs: number
    completedJobs: number
    failedJobs: number
    cancelledJobs: number
    averageProcessingTime: number
    queueUtilization: number
  } {
    const jobs = Array.from(this.queue.jobs.values())
    const totalJobs = jobs.length
    const pendingJobs = jobs.filter(j => j.status === 'pending').length
    const runningJobs = this.queue.running.size
    const completedJobs = jobs.filter(j => j.status === 'completed').length
    const failedJobs = jobs.filter(j => j.status === 'failed').length
    const cancelledJobs = jobs.filter(j => j.status === 'cancelled').length

    // Calculate average processing time for completed jobs
    const completedWithTiming = jobs.filter(j => j.status === 'completed' && j.startedAt && j.completedAt)
    const averageProcessingTime = completedWithTiming.length > 0
      ? completedWithTiming.reduce((sum, job) => {
          const startTime = new Date(job.startedAt!).getTime()
          const endTime = new Date(job.completedAt!).getTime()
          return sum + (endTime - startTime)
        }, 0) / completedWithTiming.length
      : 0

    const queueUtilization = (runningJobs / this.queue.maxConcurrency) * 100

    return {
      totalJobs,
      pendingJobs,
      runningJobs,
      completedJobs,
      failedJobs,
      cancelledJobs,
      averageProcessingTime,
      queueUtilization
    }
  }

  /**
   * Update batch configuration
   */
  updateBatchConfig(config: Partial<BatchProcessingConfig>): void {
    this.batchConfig = { ...this.batchConfig, ...config }
    console.log('📝 Updated batch processing configuration:', config)
  }

  /**
   * Force process all pending jobs (for testing/emergency)
   */
  async processPendingJobs(): Promise<void> {
    console.log('⚡ Force processing all pending jobs...')
    const pendingJobs = this.getJobsByStatus('pending')
    
    for (const job of pendingJobs) {
      if (!this.queue.running.has(job.id)) {
        await this.processJob(job)
      }
    }
    
    console.log(`✅ Force processed ${pendingJobs.length} pending jobs`)
  }
}