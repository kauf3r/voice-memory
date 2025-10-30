/**
 * Alert suppression and deduplication logic
 */

import { UnifiedAlert, SuppressionRule, SuppressionEntry } from './types'
import { areAlertsSimilar, createAlertKey } from './utils'

export class AlertSuppressor {
  private suppressionEntries: Map<string, SuppressionEntry> = new Map()
  private recentAlerts: Map<string, UnifiedAlert[]> = new Map()
  private suppressionRules: SuppressionRule[] = []

  // Configuration
  private readonly DEFAULT_SUPPRESSION_WINDOW_MINUTES = 5
  private readonly DEFAULT_SIMILAR_ALERT_THRESHOLD = 3
  private readonly MAX_RECENT_ALERTS_PER_KEY = 10

  constructor() {
    this.initializeDefaultSuppressionRules()
  }

  /**
   * Initialize default suppression rules
   */
  private initializeDefaultSuppressionRules(): void {
    this.suppressionRules = [
      {
        condition: 'type == "performance" && severity == "low"',
        durationMinutes: 15,
        reason: 'Low severity performance alerts are suppressed to reduce noise'
      },
      {
        condition: 'type == "system" && severity == "medium"',
        durationMinutes: 10,
        reason: 'Medium system alerts are temporarily suppressed for batching'
      },
      {
        condition: 'escalationLevel > 0',
        durationMinutes: 30,
        reason: 'Already escalated alerts are suppressed to prevent duplicate escalations'
      }
    ]
    
    console.log(`✅ Initialized ${this.suppressionRules.length} default suppression rules`)
  }

  /**
   * Check if an alert should be suppressed
   */
  shouldSuppressAlert(alert: UnifiedAlert): boolean {
    // Check rule-based suppression
    if (this.isRuleBasedSuppression(alert)) {
      return true
    }

    // Check deduplication suppression
    if (this.isDuplicateAlert(alert)) {
      return true
    }

    // Check rate limiting suppression
    if (this.isRateLimited(alert)) {
      return true
    }

    return false
  }

  /**
   * Suppress an alert and return suppression details
   */
  suppressAlert(alert: UnifiedAlert, durationMinutes?: number, reason?: string): SuppressionEntry {
    const alertKey = createAlertKey(alert)
    const duration = durationMinutes || this.DEFAULT_SUPPRESSION_WINDOW_MINUTES
    const suppressionReason = reason || this.determineSuppressionReason(alert)

    const suppressionEntry: SuppressionEntry = {
      alertKey,
      suppressedUntil: new Date(Date.now() + duration * 60 * 1000).toISOString(),
      reason: suppressionReason,
      count: 1
    }

    // Update existing suppression or create new one
    const existing = this.suppressionEntries.get(alertKey)
    if (existing) {
      existing.count++
      existing.suppressedUntil = suppressionEntry.suppressedUntil
      existing.reason = suppressionReason
    } else {
      this.suppressionEntries.set(alertKey, suppressionEntry)
    }

    console.log(`🔇 Alert suppressed: ${alertKey} for ${duration} minutes - ${suppressionReason}`)
    return suppressionEntry
  }

  /**
   * Check rule-based suppression
   */
  private isRuleBasedSuppression(alert: UnifiedAlert): boolean {
    for (const rule of this.suppressionRules) {
      if (this.evaluateSuppressionCondition(rule.condition, alert)) {
        this.suppressAlert(alert, rule.durationMinutes, rule.reason)
        return true
      }
    }
    return false
  }

  /**
   * Check if alert is a duplicate
   */
  private isDuplicateAlert(alert: UnifiedAlert): boolean {
    const alertKey = createAlertKey(alert)
    const recentAlertsForKey = this.recentAlerts.get(alertKey) || []

    // Check for recent similar alerts
    const similarRecentAlerts = recentAlertsForKey.filter(recentAlert => {
      const timeDiff = Date.now() - new Date(recentAlert.timestamp).getTime()
      const isRecent = timeDiff < this.DEFAULT_SUPPRESSION_WINDOW_MINUTES * 60 * 1000
      return isRecent && areAlertsSimilar(alert, recentAlert)
    })

    if (similarRecentAlerts.length > 0) {
      this.suppressAlert(
        alert, 
        this.DEFAULT_SUPPRESSION_WINDOW_MINUTES,
        `Duplicate of recent alert (${similarRecentAlerts.length} similar alerts found)`
      )
      return true
    }

    // Add current alert to recent alerts
    this.addToRecentAlerts(alertKey, alert)
    return false
  }

  /**
   * Check if alert type is rate limited
   */
  private isRateLimited(alert: UnifiedAlert): boolean {
    const alertKey = createAlertKey(alert)
    const recentAlertsForKey = this.recentAlerts.get(alertKey) || []

    // Count alerts in the last hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    const recentAlertsInHour = recentAlertsForKey.filter(recentAlert => 
      new Date(recentAlert.timestamp).getTime() > oneHourAgo
    )

    // Rate limiting thresholds by severity
    const rateLimits = {
      low: 5,      // Max 5 low severity alerts per hour
      medium: 8,   // Max 8 medium severity alerts per hour
      high: 12,    // Max 12 high severity alerts per hour
      critical: 20 // Max 20 critical alerts per hour (less restrictive)
    }

    const limit = rateLimits[alert.severity]
    if (recentAlertsInHour.length >= limit) {
      this.suppressAlert(
        alert,
        60, // Suppress for 1 hour
        `Rate limit exceeded: ${recentAlertsInHour.length}/${limit} ${alert.severity} alerts in the last hour`
      )
      return true
    }

    return false
  }

  /**
   * Add alert to recent alerts tracking
   */
  private addToRecentAlerts(alertKey: string, alert: UnifiedAlert): void {
    if (!this.recentAlerts.has(alertKey)) {
      this.recentAlerts.set(alertKey, [])
    }

    const recentAlertsForKey = this.recentAlerts.get(alertKey)!
    recentAlertsForKey.push(alert)

    // Keep only the most recent alerts
    if (recentAlertsForKey.length > this.MAX_RECENT_ALERTS_PER_KEY) {
      this.recentAlerts.set(alertKey, recentAlertsForKey.slice(-this.MAX_RECENT_ALERTS_PER_KEY))
    }
  }

  /**
   * Evaluate suppression condition
   */
  private evaluateSuppressionCondition(condition: string, alert: UnifiedAlert): boolean {
    try {
      // Simple condition evaluation - in production, use a proper expression engine
      const conditionLower = condition.toLowerCase()
      
      // Type checks
      if (conditionLower.includes('type == ')) {
        const typeMatch = conditionLower.match(/type == "(\w+)"/)
        if (typeMatch && typeMatch[1] !== alert.type) {
          return false
        }
      }

      // Severity checks
      if (conditionLower.includes('severity == ')) {
        const severityMatch = conditionLower.match(/severity == "(\w+)"/)
        if (severityMatch && severityMatch[1] !== alert.severity) {
          return false
        }
      }

      // Escalation level checks
      if (conditionLower.includes('escalationlevel')) {
        const escalationMatch = conditionLower.match(/escalationlevel ([><=]+) (\d+)/)
        if (escalationMatch) {
          const operator = escalationMatch[1]
          const value = parseInt(escalationMatch[2])
          
          switch (operator) {
            case '>': return alert.escalationLevel > value
            case '>=': return alert.escalationLevel >= value
            case '<': return alert.escalationLevel < value
            case '<=': return alert.escalationLevel <= value
            case '==': return alert.escalationLevel === value
            default: return false
          }
        }
      }

      // Source checks
      if (conditionLower.includes('source == ')) {
        const sourceMatch = conditionLower.match(/source == "([^"]+)"/)
        if (sourceMatch && sourceMatch[1] !== alert.source) {
          return false
        }
      }

      // Tag checks
      if (conditionLower.includes('hastag(')) {
        const tagMatch = conditionLower.match(/hastag\("([^"]+)"\)/)
        if (tagMatch && !alert.tags.includes(tagMatch[1])) {
          return false
        }
      }

      return true
    } catch (error) {
      console.error(`Error evaluating suppression condition "${condition}":`, error)
      return false
    }
  }

  /**
   * Determine suppression reason based on alert characteristics
   */
  private determineSuppressionReason(alert: UnifiedAlert): string {
    if (alert.severity === 'low') {
      return 'Low severity alert suppressed to reduce noise'
    }
    
    if (alert.escalationLevel > 0) {
      return 'Alert already escalated, suppressing to prevent duplicate notifications'
    }
    
    return 'Alert suppressed due to deduplication logic'
  }

  /**
   * Check if alert is currently suppressed
   */
  isAlertSuppressed(alert: UnifiedAlert): boolean {
    const alertKey = createAlertKey(alert)
    const suppression = this.suppressionEntries.get(alertKey)
    
    if (!suppression) {
      return false
    }

    // Check if suppression has expired
    if (new Date().getTime() > new Date(suppression.suppressedUntil).getTime()) {
      this.suppressionEntries.delete(alertKey)
      return false
    }

    return true
  }

  /**
   * Get suppression details for an alert
   */
  getSuppressionDetails(alert: UnifiedAlert): SuppressionEntry | null {
    const alertKey = createAlertKey(alert)
    const suppression = this.suppressionEntries.get(alertKey)
    
    if (!suppression) {
      return null
    }

    // Check if suppression has expired
    if (new Date().getTime() > new Date(suppression.suppressedUntil).getTime()) {
      this.suppressionEntries.delete(alertKey)
      return null
    }

    return { ...suppression }
  }

  /**
   * Manually unsuppress an alert type
   */
  unsuppressAlert(alert: UnifiedAlert): boolean {
    const alertKey = createAlertKey(alert)
    const existed = this.suppressionEntries.has(alertKey)
    
    if (existed) {
      this.suppressionEntries.delete(alertKey)
      console.log(`🔊 Alert unsuppressed: ${alertKey}`)
    }
    
    return existed
  }

  /**
   * Clean up expired suppressions
   */
  cleanupExpiredSuppressions(): number {
    const now = new Date().getTime()
    let removedCount = 0

    for (const [alertKey, suppression] of this.suppressionEntries.entries()) {
      if (now > new Date(suppression.suppressedUntil).getTime()) {
        this.suppressionEntries.delete(alertKey)
        removedCount++
      }
    }

    // Clean up old recent alerts (older than 2 hours)
    const twoHoursAgo = now - (2 * 60 * 60 * 1000)
    for (const [alertKey, recentAlerts] of this.recentAlerts.entries()) {
      const filteredAlerts = recentAlerts.filter(alert => 
        new Date(alert.timestamp).getTime() > twoHoursAgo
      )
      
      if (filteredAlerts.length === 0) {
        this.recentAlerts.delete(alertKey)
      } else {
        this.recentAlerts.set(alertKey, filteredAlerts)
      }
    }

    if (removedCount > 0) {
      console.log(`🗑️ Cleaned up ${removedCount} expired suppressions`)
    }

    return removedCount
  }

  /**
   * Get all active suppressions
   */
  getActiveSuppressions(): SuppressionEntry[] {
    const now = new Date().getTime()
    const activeSuppressions: SuppressionEntry[] = []

    for (const suppression of this.suppressionEntries.values()) {
      if (new Date(suppression.suppressedUntil).getTime() > now) {
        activeSuppressions.push({ ...suppression })
      }
    }

    return activeSuppressions.sort((a, b) => 
      new Date(a.suppressedUntil).getTime() - new Date(b.suppressedUntil).getTime()
    )
  }

  /**
   * Add suppression rule
   */
  addSuppressionRule(rule: SuppressionRule): void {
    this.suppressionRules.push(rule)
    console.log(`📋 Suppression rule added: ${rule.reason}`)
  }

  /**
   * Remove suppression rule
   */
  removeSuppressionRule(condition: string): boolean {
    const initialLength = this.suppressionRules.length
    this.suppressionRules = this.suppressionRules.filter(rule => rule.condition !== condition)
    
    const removed = this.suppressionRules.length < initialLength
    if (removed) {
      console.log(`🗑️ Suppression rule removed: ${condition}`)
    }
    
    return removed
  }

  /**
   * Get all suppression rules
   */
  getSuppressionRules(): SuppressionRule[] {
    return [...this.suppressionRules]
  }

  /**
   * Get suppression statistics
   */
  getSuppressionStatistics(): {
    activeSuppressions: number
    totalSuppressedAlerts: number
    suppressionsByReason: Record<string, number>
    topSuppressedAlertTypes: Array<{ alertKey: string; count: number }>
  } {
    const activeSuppressions = this.getActiveSuppressions()
    const totalSuppressedAlerts = Array.from(this.suppressionEntries.values())
      .reduce((sum, entry) => sum + entry.count, 0)

    const suppressionsByReason: Record<string, number> = {}
    const suppressedCounts: Record<string, number> = {}

    for (const suppression of this.suppressionEntries.values()) {
      // Count by reason
      suppressionsByReason[suppression.reason] = 
        (suppressionsByReason[suppression.reason] || 0) + suppression.count

      // Count by alert key
      suppressedCounts[suppression.alertKey] = suppression.count
    }

    const topSuppressedAlertTypes = Object.entries(suppressedCounts)
      .map(([alertKey, count]) => ({ alertKey, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      activeSuppressions: activeSuppressions.length,
      totalSuppressedAlerts,
      suppressionsByReason,
      topSuppressedAlertTypes
    }
  }

  /**
   * Reset all suppressions (for testing or maintenance)
   */
  resetSuppressions(): void {
    this.suppressionEntries.clear()
    this.recentAlerts.clear()
    console.log('🔄 All suppressions reset')
  }

  /**
   * Test suppression rule against sample alert
   */
  testSuppressionRule(rule: SuppressionRule, sampleAlert: UnifiedAlert): boolean {
    return this.evaluateSuppressionCondition(rule.condition, sampleAlert)
  }

  /**
   * Get suppression forecast (predict if alert would be suppressed)
   */
  wouldSuppressAlert(alert: UnifiedAlert): {
    wouldSuppress: boolean
    reason?: string
    durationMinutes?: number
    suppressionType?: 'rule-based' | 'duplicate' | 'rate-limited'
  } {
    // Check rule-based suppression
    for (const rule of this.suppressionRules) {
      if (this.evaluateSuppressionCondition(rule.condition, alert)) {
        return {
          wouldSuppress: true,
          reason: rule.reason,
          durationMinutes: rule.durationMinutes,
          suppressionType: 'rule-based'
        }
      }
    }

    // Check for duplicates (without modifying state)
    const alertKey = createAlertKey(alert)
    const recentAlertsForKey = this.recentAlerts.get(alertKey) || []
    const similarRecentAlerts = recentAlertsForKey.filter(recentAlert => {
      const timeDiff = Date.now() - new Date(recentAlert.timestamp).getTime()
      const isRecent = timeDiff < this.DEFAULT_SUPPRESSION_WINDOW_MINUTES * 60 * 1000
      return isRecent && areAlertsSimilar(alert, recentAlert)
    })

    if (similarRecentAlerts.length > 0) {
      return {
        wouldSuppress: true,
        reason: `Duplicate of recent alert (${similarRecentAlerts.length} similar alerts found)`,
        durationMinutes: this.DEFAULT_SUPPRESSION_WINDOW_MINUTES,
        suppressionType: 'duplicate'
      }
    }

    // Check rate limiting (without modifying state)
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    const recentAlertsInHour = recentAlertsForKey.filter(recentAlert => 
      new Date(recentAlert.timestamp).getTime() > oneHourAgo
    )

    const rateLimits = { low: 5, medium: 8, high: 12, critical: 20 }
    const limit = rateLimits[alert.severity]
    
    if (recentAlertsInHour.length >= limit) {
      return {
        wouldSuppress: true,
        reason: `Rate limit exceeded: ${recentAlertsInHour.length}/${limit} ${alert.severity} alerts in the last hour`,
        durationMinutes: 60,
        suppressionType: 'rate-limited'
      }
    }

    return { wouldSuppress: false }
  }
}