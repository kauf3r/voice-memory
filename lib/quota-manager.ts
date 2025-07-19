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

  constructor(limits: QuotaLimits = DEFAULT_LIMITS) {
    this.limits = limits
  }
  
  private getSupabase() {
    return createServerClient()
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
   * Record API token usage
   */
  async recordTokenUsage(userId: string, tokens: number): Promise<void> {
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
        console.error('Error recording token usage:', error)
      }
    } catch (error) {
      console.error('Error recording token usage:', error)
    }
  }

  /**
   * Record processing attempt
   */
  async recordProcessingAttempt(userId: string): Promise<void> {
    try {
      const { error } = await this.getSupabase()
        .from('processing_attempts')
        .insert({
          user_id: userId,
          attempted_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error recording processing attempt:', error)
      }
    } catch (error) {
      console.error('Error recording processing attempt:', error)
    }
  }

  /**
   * Get current user usage statistics
   */
  async getUserUsage(userId: string): Promise<QuotaUsage> {
    // Get notes count
    const { count: notesCount } = await this.getSupabase()
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Get processing attempts in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: processingThisHour } = await this.getSupabase()
      .from('processing_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('attempted_at', oneHourAgo)

    // Get token usage today
    const today = new Date().toISOString().split('T')[0]
    const { data: tokenData } = await this.getSupabase()
      .from('api_usage')
      .select('tokens_used')
      .eq('user_id', userId)
      .eq('date', today)
      .single()

    const tokensToday = tokenData?.tokens_used || 0

    // Estimate storage usage (simplified - could be more accurate with actual file sizes)
    const storageMB = (notesCount || 0) * 2 // Estimate 2MB per note on average

    return {
      notesCount: notesCount || 0,
      processingThisHour: processingThisHour || 0,
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