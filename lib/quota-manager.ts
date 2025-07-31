import { createServerClient } from './supabase-server'

export interface QuotaLimits {
  maxNotesPerUser: number
  maxProcessingPerHour: number
  maxTokensPerDay: number
  maxStorageMB: number
}

export interface QuotaUsage {
  notesCount: number
  processingThisHour: number
  tokensToday: number
  storageMB: number
}

export interface QuotaCheck {
  allowed: boolean
  reason?: string
  usage: QuotaUsage
  limits: QuotaLimits
}

const DEFAULT_LIMITS: QuotaLimits = {
  maxNotesPerUser: 100,
  maxProcessingPerHour: 10,
  maxTokensPerDay: 50000,
  maxStorageMB: 500
}

export class QuotaManager {
  private limits: QuotaLimits
  private tablesChecked: boolean = false
  private tableStatus: Map<string, boolean> = new Map()
  private lastTableCheck: number = 0
  private readonly TABLE_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes

  constructor(limits: QuotaLimits = DEFAULT_LIMITS) {
    this.limits = limits
  }
  
  private getSupabase() {
    return createServerClient()
  }

  /**
   * Check if required tables exist and are accessible
   */
  private async checkTablesExist(): Promise<void> {
    const now = Date.now()
    
    // Only check table existence every 5 minutes to avoid overhead
    if (this.tablesChecked && (now - this.lastTableCheck < this.TABLE_CHECK_INTERVAL)) {
      return
    }
    
    const tablesToCheck = ['notes', 'processing_attempts', 'api_usage']
    
    for (const tableName of tablesToCheck) {
      try {
        // Try a simple select to test table existence and accessibility
        const { error } = await this.getSupabase()
          .from(tableName)
          .select('*')
          .limit(1)
          .maybeSingle()
        
        if (error) {
          // Check for table existence errors
          if (error.code === '42P01' || // relation does not exist
              error.message.includes(`relation "${tableName}" does not exist`) ||
              error.message.includes(`table "${tableName}" does not exist`)) {
            console.warn(`QuotaManager: ${tableName} table does not exist`)
            this.tableStatus.set(tableName, false)
          } else if (error.code === '42501' || // insufficient privilege
                     error.message.includes('permission denied') ||
                     error.message.includes('insufficient privilege')) {
            console.warn(`QuotaManager: insufficient permissions for ${tableName} table`)
            this.tableStatus.set(tableName, false)
          } else {
            console.warn(`QuotaManager: database error for ${tableName} table:`, error)
            this.tableStatus.set(tableName, false)
          }
        } else {
          this.tableStatus.set(tableName, true)
        }
      } catch (error) {
        console.warn(`QuotaManager: failed to check ${tableName} table existence:`, error)
        this.tableStatus.set(tableName, false)
      }
    }
    
    this.tablesChecked = true
    this.lastTableCheck = now
  }

  /**
   * Check if a specific table is available
   */
  private async isTableAvailable(tableName: string): Promise<boolean> {
    await this.checkTablesExist()
    return this.tableStatus.get(tableName) ?? false
  }

  /**
   * Safe database operation with error handling and fallbacks
   */
  private async safeDbOperation<T>(
    operation: () => Promise<T>,
    fallbackValue: T,
    operationName: string
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      console.warn(`QuotaManager: ${operationName} failed, using fallback:`, error)
      return fallbackValue
    }
  }

  /**
   * Get notes count with fallback
   */
  private async getNotesCount(userId: string): Promise<number> {
    if (!(await this.isTableAvailable('notes'))) {
      console.warn('QuotaManager: notes table not available, returning 0 count')
      return 0
    }

    return this.safeDbOperation(
      async () => {
        const { count, error } = await this.getSupabase()
          .from('notes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)

        if (error) {
          if (error.code === '42P01' || 
              error.message.includes('relation "notes" does not exist')) {
            // Table was dropped during operation
            this.tableStatus.set('notes', false)
            this.tablesChecked = false
            console.warn('QuotaManager: notes table no longer exists')
            return 0
          }
          throw error
        }

        return count || 0
      },
      0,
      'getNotesCount'
    )
  }

  /**
   * Get processing attempts count with fallback
   */
  private async getProcessingAttemptsCount(userId: string): Promise<number> {
    if (!(await this.isTableAvailable('processing_attempts'))) {
      console.warn('QuotaManager: processing_attempts table not available, returning 0 count')
      return 0
    }

    return this.safeDbOperation(
      async () => {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { count, error } = await this.getSupabase()
          .from('processing_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('attempted_at', oneHourAgo)

        if (error) {
          if (error.code === '42P01' || 
              error.message.includes('relation "processing_attempts" does not exist')) {
            // Table was dropped during operation
            this.tableStatus.set('processing_attempts', false)
            this.tablesChecked = false
            console.warn('QuotaManager: processing_attempts table no longer exists')
            return 0
          }
          throw error
        }

        return count || 0
      },
      0,
      'getProcessingAttemptsCount'
    )
  }

  /**
   * Get token usage with fallback
   */
  private async getTokenUsage(userId: string): Promise<number> {
    if (!(await this.isTableAvailable('api_usage'))) {
      console.warn('QuotaManager: api_usage table not available, returning 0 tokens')
      return 0
    }

    return this.safeDbOperation(
      async () => {
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await this.getSupabase()
          .from('api_usage')
          .select('tokens_used')
          .eq('user_id', userId)
          .eq('date', today)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            // No data found - this is fine
            return 0
          }
          if (error.code === '42P01' || 
              error.message.includes('relation "api_usage" does not exist')) {
            // Table was dropped during operation
            this.tableStatus.set('api_usage', false)
            this.tablesChecked = false
            console.warn('QuotaManager: api_usage table no longer exists')
            return 0
          }
          throw error
        }

        return data?.tokens_used || 0
      },
      0,
      'getTokenUsage'
    )
  }

  /**
   * Check if user can upload a new note
   */
  async checkUploadQuota(userId: string): Promise<QuotaCheck> {
    try {
      const usage = await this.getUserUsage(userId)
      
      // Check notes count limit
      if (usage.notesCount >= this.limits.maxNotesPerUser) {
        return {
          allowed: false,
          reason: `Maximum of ${this.limits.maxNotesPerUser} notes reached. Please delete some notes to upload new ones.`,
          usage,
          limits: this.limits
        }
      }

      // Check storage limit
      if (usage.storageMB >= this.limits.maxStorageMB) {
        return {
          allowed: false,
          reason: `Storage limit of ${this.limits.maxStorageMB}MB exceeded. Please delete some notes to free up space.`,
          usage,
          limits: this.limits
        }
      }

      return {
        allowed: true,
        usage,
        limits: this.limits
      }
    } catch (error) {
      console.error('Error checking upload quota:', error)
      // Allow upload if quota check fails (fail open)
      return {
        allowed: true,
        usage: { notesCount: 0, processingThisHour: 0, tokensToday: 0, storageMB: 0 },
        limits: this.limits
      }
    }
  }

  /**
   * Check if user can process a note
   */
  async checkProcessingQuota(userId: string): Promise<QuotaCheck> {
    try {
      const usage = await this.getUserUsage(userId)
      
      // Check processing per hour limit
      if (usage.processingThisHour >= this.limits.maxProcessingPerHour) {
        return {
          allowed: false,
          reason: `Processing limit of ${this.limits.maxProcessingPerHour} per hour exceeded. Please wait before processing more notes.`,
          usage,
          limits: this.limits
        }
      }

      return {
        allowed: true,
        usage,
        limits: this.limits
      }
    } catch (error) {
      console.error('Error checking processing quota:', error)
      // Allow processing if quota check fails (fail open)
      return {
        allowed: true,
        usage: { notesCount: 0, processingThisHour: 0, tokensToday: 0, storageMB: 0 },
        limits: this.limits
      }
    }
  }

  /**
   * Record API token usage with enhanced error handling
   */
  async recordTokenUsage(userId: string, tokens: number): Promise<void> {
    if (!(await this.isTableAvailable('api_usage'))) {
      console.warn('QuotaManager: api_usage table not available, skipping token usage recording')
      return
    }

    const maxRetries = 3
    let retryCount = 0

    while (retryCount < maxRetries) {
      try {
        const today = new Date().toISOString().split('T')[0]
        
        const { error } = await this.getSupabase()
          .from('api_usage')
          .upsert({
            user_id: userId,
            date: today,
            tokens_used: tokens
          }, {
            onConflict: 'user_id,date',
            ignoreDuplicates: false
          })

        if (error) {
          if (error.code === '42P01' || 
              error.message.includes('relation "api_usage" does not exist')) {
            // Table was dropped during operation
            this.tableStatus.set('api_usage', false)
            this.tablesChecked = false
            console.warn('QuotaManager: api_usage table no longer exists, skipping token recording')
            return
          }
          throw error
        }
        
        // Success
        return
        
      } catch (error) {
        retryCount++
        if (retryCount >= maxRetries) {
          console.error(`QuotaManager: failed to record token usage after ${maxRetries} retries:`, error)
          return
        }
        
        // Short delay before retry
        await new Promise(resolve => setTimeout(resolve, 100 * retryCount))
      }
    }
  }

  /**
   * Record processing attempt with enhanced error handling
   */
  async recordProcessingAttempt(userId: string): Promise<void> {
    if (!(await this.isTableAvailable('processing_attempts'))) {
      console.warn('QuotaManager: processing_attempts table not available, skipping processing attempt recording')
      return
    }

    const maxRetries = 3
    let retryCount = 0

    while (retryCount < maxRetries) {
      try {
        const { error } = await this.getSupabase()
          .from('processing_attempts')
          .insert({
            user_id: userId,
            attempted_at: new Date().toISOString()
          })

        if (error) {
          if (error.code === '42P01' || 
              error.message.includes('relation "processing_attempts" does not exist')) {
            // Table was dropped during operation
            this.tableStatus.set('processing_attempts', false)
            this.tablesChecked = false
            console.warn('QuotaManager: processing_attempts table no longer exists, skipping processing attempt recording')
            return
          }
          throw error
        }
        
        // Success
        return
        
      } catch (error) {
        retryCount++
        if (retryCount >= maxRetries) {
          console.error(`QuotaManager: failed to record processing attempt after ${maxRetries} retries:`, error)
          return
        }
        
        // Short delay before retry
        await new Promise(resolve => setTimeout(resolve, 100 * retryCount))
      }
    }
  }

  /**
   * Get current user usage statistics with enhanced error handling
   */
  async getUserUsage(userId: string): Promise<QuotaUsage> {
    // Get data from all sources with individual error handling
    const [notesCount, processingThisHour, tokensToday] = await Promise.all([
      this.getNotesCount(userId),
      this.getProcessingAttemptsCount(userId),
      this.getTokenUsage(userId)
    ])

    // Estimate storage usage (simplified - could be more accurate with actual file sizes)
    const storageMB = notesCount * 2 // Estimate 2MB per note on average

    return {
      notesCount,
      processingThisHour,
      tokensToday,
      storageMB
    }
  }

  /**
   * Get quota status for display in UI
   */
  async getQuotaStatus(userId: string) {
    const usage = await this.getUserUsage(userId)
    
    return {
      usage,
      limits: this.limits,
      percentages: {
        notes: Math.round((usage.notesCount / this.limits.maxNotesPerUser) * 100),
        processing: Math.round((usage.processingThisHour / this.limits.maxProcessingPerHour) * 100),
        tokens: Math.round((usage.tokensToday / this.limits.maxTokensPerDay) * 100),
        storage: Math.round((usage.storageMB / this.limits.maxStorageMB) * 100)
      }
    }
  }
}

// Global instance - lazy initialization
let _quotaManager: QuotaManager | null = null

export function getQuotaManager(): QuotaManager {
  if (!_quotaManager) {
    _quotaManager = new QuotaManager()
  }
  return _quotaManager
}

// For backward compatibility
export const quotaManager = {
  checkUploadQuota: (userId: string) => getQuotaManager().checkUploadQuota(userId),
  checkProcessingQuota: (userId: string) => getQuotaManager().checkProcessingQuota(userId),
  recordProcessingAttempt: (userId: string) => getQuotaManager().recordProcessingAttempt(userId),
  recordTokenUsage: (userId: string, tokens: number) => getQuotaManager().recordTokenUsage(userId, tokens),
  getUserUsage: (userId: string) => getQuotaManager().getUserUsage(userId),
  getQuotaStatus: (userId: string) => getQuotaManager().getQuotaStatus(userId)
}