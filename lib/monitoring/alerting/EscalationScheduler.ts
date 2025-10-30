/**
 * Escalation scheduling and timer management
 */

import { EscalationRule, EscalationTimer, UnifiedAlert, AlertRule } from './types'

export class EscalationScheduler {
  private escalationTimers: Map<string, EscalationTimer> = new Map()
  private escalationHistory: Map<string, Array<{
    level: number
    timestamp: string
    scheduledFor: string
    executed: boolean
  }>> = new Map()

  /**
   * Schedule escalation for an alert based on rule
   */
  scheduleEscalation(alert: UnifiedAlert, rule: AlertRule): void {
    // Clear any existing escalation for this alert
    this.clearEscalation(alert.id)

    if (rule.escalationRules.length === 0) {
      return
    }

    // Schedule first escalation level
    this.scheduleNextEscalation(alert, rule, 0)
  }

  /**
   * Schedule the next escalation level
   */
  private scheduleNextEscalation(alert: UnifiedAlert, rule: AlertRule, currentLevel: number): void {
    const nextEscalation = rule.escalationRules[currentLevel]
    if (!nextEscalation) {
      return
    }

    const scheduledTime = Date.now() + (nextEscalation.delayMinutes * 60 * 1000)
    
    const timer = setTimeout(async () => {
      await this.executeEscalation(alert.id, nextEscalation, rule, currentLevel)
    }, nextEscalation.delayMinutes * 60 * 1000)

    const escalationTimer: EscalationTimer = {
      alertId: alert.id,
      level: nextEscalation.level,
      scheduledAt: new Date().toISOString(),
      timer
    }

    this.escalationTimers.set(alert.id, escalationTimer)

    // Record in history
    this.addToHistory(alert.id, nextEscalation.level, new Date(scheduledTime).toISOString())

    console.log(`⏰ Escalation scheduled for alert ${alert.id} to level ${nextEscalation.level} in ${nextEscalation.delayMinutes} minutes`)
  }

  /**
   * Execute escalation for an alert
   */
  private async executeEscalation(alertId: string, escalation: EscalationRule, rule: AlertRule, levelIndex: number): Promise<void> {
    // Check if alert still exists and is active
    const onEscalate = this.escalationCallbacks.get('escalate')
    if (!onEscalate) {
      console.error('No escalation callback registered')
      return
    }

    try {
      // Execute the escalation callback
      const success = await onEscalate(alertId, escalation)
      
      if (success) {
        // Mark as executed in history
        this.markExecutedInHistory(alertId, escalation.level)
        
        // Schedule next escalation if exists
        const nextLevelIndex = levelIndex + 1
        if (nextLevelIndex < rule.escalationRules.length) {
          // Get the current alert to pass to next escalation
          const getCurrentAlert = this.escalationCallbacks.get('getCurrentAlert')
          if (getCurrentAlert) {
            const currentAlert = await getCurrentAlert(alertId)
            if (currentAlert && currentAlert.status === 'active') {
              this.scheduleNextEscalation(currentAlert, rule, nextLevelIndex)
            }
          }
        }
        
        console.log(`⬆️ Escalation executed for alert ${alertId} to level ${escalation.level}`)
      } else {
        console.error(`Failed to execute escalation for alert ${alertId}`)
      }
    } catch (error) {
      console.error(`Error executing escalation for alert ${alertId}:`, error)
    } finally {
      // Clean up timer
      this.escalationTimers.delete(alertId)
    }
  }

  /**
   * Clear escalation for an alert
   */
  clearEscalation(alertId: string): void {
    const escalationTimer = this.escalationTimers.get(alertId)
    if (escalationTimer) {
      clearTimeout(escalationTimer.timer)
      this.escalationTimers.delete(alertId)
      console.log(`🚫 Escalation cleared for alert ${alertId}`)
    }
  }

  /**
   * Clear all escalations (for shutdown)
   */
  clearAllEscalations(): void {
    for (const [alertId, escalationTimer] of this.escalationTimers.entries()) {
      clearTimeout(escalationTimer.timer)
    }
    this.escalationTimers.clear()
    console.log('🛑 All escalations cleared')
  }

  /**
   * Get pending escalations
   */
  getPendingEscalations(): Array<{
    alertId: string
    level: number
    scheduledAt: string
    estimatedExecution: string
  }> {
    return Array.from(this.escalationTimers.values()).map(timer => ({
      alertId: timer.alertId,
      level: timer.level,
      scheduledAt: timer.scheduledAt,
      estimatedExecution: new Date(
        new Date(timer.scheduledAt).getTime() + 
        this.getDelayFromLevel(timer.level) * 60 * 1000
      ).toISOString()
    }))
  }

  /**
   * Get escalation history for an alert
   */
  getEscalationHistory(alertId: string): Array<{
    level: number
    timestamp: string
    scheduledFor: string
    executed: boolean
  }> {
    return this.escalationHistory.get(alertId) || []
  }

  /**
   * Get all escalation history
   */
  getAllEscalationHistory(): Record<string, Array<{
    level: number
    timestamp: string
    scheduledFor: string
    executed: boolean
  }>> {
    const history: Record<string, any> = {}
    for (const [alertId, entries] of this.escalationHistory.entries()) {
      history[alertId] = [...entries]
    }
    return history
  }

  /**
   * Add entry to escalation history
   */
  private addToHistory(alertId: string, level: number, scheduledFor: string): void {
    if (!this.escalationHistory.has(alertId)) {
      this.escalationHistory.set(alertId, [])
    }

    const history = this.escalationHistory.get(alertId)!
    history.push({
      level,
      timestamp: new Date().toISOString(),
      scheduledFor,
      executed: false
    })

    // Keep only last 20 entries per alert
    if (history.length > 20) {
      this.escalationHistory.set(alertId, history.slice(-20))
    }
  }

  /**
   * Mark escalation as executed in history
   */
  private markExecutedInHistory(alertId: string, level: number): void {
    const history = this.escalationHistory.get(alertId)
    if (history) {
      const entry = history.find(h => h.level === level && !h.executed)
      if (entry) {
        entry.executed = true
      }
    }
  }

  /**
   * Get delay for escalation level (helper for estimation)
   */
  private getDelayFromLevel(level: number): number {
    // Default delays - in practice, this would come from the rule
    const defaultDelays = [5, 15, 30, 60] // minutes
    return defaultDelays[level - 1] || 60
  }

  /**
   * Check if alert has pending escalations
   */
  hasPendingEscalation(alertId: string): boolean {
    return this.escalationTimers.has(alertId)
  }

  /**
   * Get escalation statistics
   */
  getEscalationStatistics(): {
    totalPending: number
    totalHistoryEntries: number
    executionRate: number
    averageDelayMinutes: number
  } {
    const totalPending = this.escalationTimers.size
    let totalHistoryEntries = 0
    let executedCount = 0
    let totalDelay = 0

    for (const history of this.escalationHistory.values()) {
      totalHistoryEntries += history.length
      executedCount += history.filter(h => h.executed).length
      
      for (const entry of history) {
        if (entry.executed) {
          const delay = new Date(entry.scheduledFor).getTime() - new Date(entry.timestamp).getTime()
          totalDelay += delay / (1000 * 60) // Convert to minutes
        }
      }
    }

    return {
      totalPending,
      totalHistoryEntries,
      executionRate: totalHistoryEntries > 0 ? (executedCount / totalHistoryEntries) * 100 : 0,
      averageDelayMinutes: executedCount > 0 ? totalDelay / executedCount : 0
    }
  }

  /**
   * Reschedule escalation with new delay
   */
  rescheduleEscalation(alertId: string, newDelayMinutes: number): boolean {
    const escalationTimer = this.escalationTimers.get(alertId)
    if (!escalationTimer) {
      return false
    }

    // Clear existing timer
    clearTimeout(escalationTimer.timer)

    // Create new timer with updated delay
    const newTimer = setTimeout(async () => {
      // Need to reconstruct the escalation - this is a simplified version
      // In practice, you'd store the rule and escalation data
      const onEscalate = this.escalationCallbacks.get('escalate')
      if (onEscalate) {
        await onEscalate(alertId, { 
          level: escalationTimer.level, 
          delayMinutes: newDelayMinutes, 
          notificationChannels: [] 
        })
      }
    }, newDelayMinutes * 60 * 1000)

    // Update timer
    escalationTimer.timer = newTimer
    escalationTimer.scheduledAt = new Date().toISOString()

    console.log(`🔄 Escalation rescheduled for alert ${alertId} with ${newDelayMinutes} minute delay`)
    return true
  }

  /**
   * Cleanup old escalation history
   */
  cleanupHistory(retentionHours: number = 24): number {
    const cutoffTime = Date.now() - (retentionHours * 60 * 60 * 1000)
    let cleanedEntries = 0

    for (const [alertId, history] of this.escalationHistory.entries()) {
      const filteredHistory = history.filter(entry => 
        new Date(entry.timestamp).getTime() > cutoffTime
      )
      
      cleanedEntries += history.length - filteredHistory.length

      if (filteredHistory.length === 0) {
        this.escalationHistory.delete(alertId)
      } else {
        this.escalationHistory.set(alertId, filteredHistory)
      }
    }

    if (cleanedEntries > 0) {
      console.log(`🗑️ Cleaned up ${cleanedEntries} old escalation history entries`)
    }

    return cleanedEntries
  }

  // Callback system for external dependencies
  private escalationCallbacks: Map<string, Function> = new Map()

  /**
   * Register callback for escalation execution
   */
  onEscalate(callback: (alertId: string, escalation: EscalationRule) => Promise<boolean>): void {
    this.escalationCallbacks.set('escalate', callback)
  }

  /**
   * Register callback to get current alert state
   */
  onGetCurrentAlert(callback: (alertId: string) => Promise<UnifiedAlert | null>): void {
    this.escalationCallbacks.set('getCurrentAlert', callback)
  }

  /**
   * Validate escalation rule
   */
  validateEscalationRule(rule: EscalationRule): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (rule.level < 1) {
      errors.push('Escalation level must be >= 1')
    }

    if (rule.delayMinutes < 0) {
      errors.push('Delay minutes must be non-negative')
    }

    if (!rule.notificationChannels || rule.notificationChannels.length === 0) {
      errors.push('At least one notification channel is required')
    }

    if (rule.delayMinutes > 1440) { // 24 hours
      errors.push('Delay minutes should not exceed 24 hours (1440 minutes)')
    }

    return { isValid: errors.length === 0, errors }
  }
}