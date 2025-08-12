/**
 * Alert rule engine for condition evaluation and rule management
 */

import { AlertRule, UnifiedAlert, AlertType, AlertSeverity } from './types'
import { AlertingConfigManager } from './config'

export class AlertRuleEngine {
  private alertRules: Map<string, AlertRule> = new Map()
  private configManager: AlertingConfigManager

  constructor(configManager?: AlertingConfigManager) {
    this.configManager = configManager || new AlertingConfigManager()
    this.initializeDefaultRules()
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules = this.configManager.getDefaultAlertRules()
    
    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule)
    })

    console.log(`✅ Initialized ${defaultRules.length} alert rules`)
  }

  /**
   * Add or update an alert rule
   */
  addRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, { ...rule })
    console.log(`📋 Alert rule added/updated: ${rule.name}`)
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): boolean {
    const rule = this.alertRules.get(ruleId)
    if (rule) {
      this.alertRules.delete(ruleId)
      console.log(`🗑️ Alert rule removed: ${rule.name}`)
      return true
    }
    return false
  }

  /**
   * Get alert rule by ID
   */
  getRule(ruleId: string): AlertRule | null {
    const rule = this.alertRules.get(ruleId)
    return rule ? { ...rule } : null
  }

  /**
   * Get all alert rules
   */
  getAllRules(): AlertRule[] {
    return Array.from(this.alertRules.values()).map(rule => ({ ...rule }))
  }

  /**
   * Get enabled alert rules
   */
  getEnabledRules(): AlertRule[] {
    return Array.from(this.alertRules.values())
      .filter(rule => rule.enabled)
      .map(rule => ({ ...rule }))
  }

  /**
   * Enable or disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.alertRules.get(ruleId)
    if (rule) {
      rule.enabled = enabled
      console.log(`${enabled ? '✅' : '❌'} Alert rule ${enabled ? 'enabled' : 'disabled'}: ${rule.name}`)
      return true
    }
    return false
  }

  /**
   * Find matching rules for an alert
   */
  findMatchingRules(alert: UnifiedAlert): AlertRule[] {
    return Array.from(this.alertRules.values())
      .filter(rule => rule.enabled && this.evaluateAlertCondition(rule, alert))
  }

  /**
   * Evaluate if an alert matches a rule condition
   */
  evaluateAlertCondition(rule: AlertRule, alert: UnifiedAlert): boolean {
    try {
      // Basic condition evaluation - in production, use a proper expression engine
      const condition = rule.condition.toLowerCase()
      
      // Direct property matches
      if (condition.includes('severity')) {
        return this.evaluateSeverityCondition(condition, alert.severity)
      }
      
      if (condition.includes('type')) {
        return this.evaluateTypeCondition(condition, alert.type)
      }

      // Tag-based conditions
      if (condition.includes('tag:')) {
        return this.evaluateTagCondition(condition, alert.tags)
      }

      // Source-based conditions
      if (condition.includes('source')) {
        return this.evaluateSourceCondition(condition, alert.source)
      }

      // Detail-based conditions (for specific metrics)
      if (condition.includes('details.')) {
        return this.evaluateDetailCondition(condition, alert.details)
      }

      // Default to match for simple conditions
      return true
    } catch (error) {
      console.error(`Error evaluating rule condition "${rule.condition}":`, error)
      return false
    }
  }

  /**
   * Evaluate severity-based conditions
   */
  private evaluateSeverityCondition(condition: string, severity: AlertSeverity): boolean {
    if (condition.includes(`== ${severity}`) || condition.includes(`"${severity}"`)) {
      return true
    }
    
    // Handle severity comparison (critical > high > medium > low)
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 }
    const currentLevel = severityLevels[severity]
    
    if (condition.includes('> ')) {
      const match = condition.match(/> (\w+)/)
      if (match) {
        const compareLevel = severityLevels[match[1] as AlertSeverity]
        return currentLevel > compareLevel
      }
    }
    
    if (condition.includes('>= ')) {
      const match = condition.match(/>= (\w+)/)
      if (match) {
        const compareLevel = severityLevels[match[1] as AlertSeverity]
        return currentLevel >= compareLevel
      }
    }

    return false
  }

  /**
   * Evaluate type-based conditions
   */
  private evaluateTypeCondition(condition: string, type: AlertType): boolean {
    return condition.includes(`== ${type}`) || 
           condition.includes(`"${type}"`) ||
           condition.includes(type)
  }

  /**
   * Evaluate tag-based conditions
   */
  private evaluateTagCondition(condition: string, tags: string[]): boolean {
    const tagMatch = condition.match(/tag:(\w+)/)
    if (tagMatch) {
      return tags.includes(tagMatch[1])
    }
    return false
  }

  /**
   * Evaluate source-based conditions
   */
  private evaluateSourceCondition(condition: string, source: string): boolean {
    return condition.includes(`== "${source}"`) || 
           condition.includes(`source == ${source}`) ||
           condition.includes(source)
  }

  /**
   * Evaluate detail-based conditions (for specific metrics)
   */
  private evaluateDetailCondition(condition: string, details: any): boolean {
    try {
      // Simple path evaluation - in production, use a proper expression evaluator
      const match = condition.match(/details\.(\w+(?:\.\w+)*)\s*(==|!=|>|<|>=|<=)\s*(.+)/)
      if (!match) return false

      const [, path, operator, valueStr] = match
      const actualValue = this.getNestedValue(details, path)
      const expectedValue = this.parseValue(valueStr.trim())

      switch (operator) {
        case '==': return actualValue == expectedValue
        case '!=': return actualValue != expectedValue
        case '>': return Number(actualValue) > Number(expectedValue)
        case '<': return Number(actualValue) < Number(expectedValue)
        case '>=': return Number(actualValue) >= Number(expectedValue)
        case '<=': return Number(actualValue) <= Number(expectedValue)
        default: return false
      }
    } catch (error) {
      console.error('Error evaluating detail condition:', error)
      return false
    }
  }

  /**
   * Get nested value from object by path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Parse value from condition string
   */
  private parseValue(valueStr: string): any {
    // Remove quotes
    if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
        (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
      return valueStr.slice(1, -1)
    }

    // Parse boolean
    if (valueStr === 'true') return true
    if (valueStr === 'false') return false

    // Parse number
    const num = Number(valueStr)
    if (!isNaN(num)) return num

    // Return as string
    return valueStr
  }

  /**
   * Validate alert rule
   */
  validateRule(rule: AlertRule): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!rule.id || rule.id.trim().length === 0) {
      errors.push('Rule ID is required')
    }

    if (!rule.name || rule.name.trim().length === 0) {
      errors.push('Rule name is required')
    }

    if (!rule.condition || rule.condition.trim().length === 0) {
      errors.push('Rule condition is required')
    }

    if (!['low', 'medium', 'high', 'critical'].includes(rule.severity)) {
      errors.push('Rule severity must be low, medium, high, or critical')
    }

    if (rule.cooldownMinutes < 0) {
      errors.push('Cooldown minutes must be non-negative')
    }

    if (rule.escalationRules) {
      rule.escalationRules.forEach((escalation, index) => {
        if (escalation.level < 1) {
          errors.push(`Escalation rule ${index + 1}: level must be >= 1`)
        }
        if (escalation.delayMinutes < 0) {
          errors.push(`Escalation rule ${index + 1}: delay must be non-negative`)
        }
        if (!escalation.notificationChannels || escalation.notificationChannels.length === 0) {
          errors.push(`Escalation rule ${index + 1}: at least one notification channel is required`)
        }
      })
    }

    return { isValid: errors.length === 0, errors }
  }

  /**
   * Test rule condition against sample data
   */
  testRuleCondition(ruleId: string, sampleAlert: UnifiedAlert): boolean {
    const rule = this.alertRules.get(ruleId)
    if (!rule) {
      throw new Error(`Rule not found: ${ruleId}`)
    }

    return this.evaluateAlertCondition(rule, sampleAlert)
  }

  /**
   * Get rules by tag
   */
  getRulesByTag(tag: string): AlertRule[] {
    return Array.from(this.alertRules.values())
      .filter(rule => rule.tags.includes(tag))
      .map(rule => ({ ...rule }))
  }

  /**
   * Get rules by severity
   */
  getRulesBySeverity(severity: AlertSeverity): AlertRule[] {
    return Array.from(this.alertRules.values())
      .filter(rule => rule.severity === severity)
      .map(rule => ({ ...rule }))
  }

  /**
   * Check if rule is in cooldown period
   */
  isRuleInCooldown(ruleId: string, lastTriggered?: string): boolean {
    const rule = this.alertRules.get(ruleId)
    if (!rule || !lastTriggered) {
      return false
    }

    const cooldownEnd = new Date(lastTriggered).getTime() + (rule.cooldownMinutes * 60 * 1000)
    return Date.now() < cooldownEnd
  }

  /**
   * Get rule statistics
   */
  getRuleStatistics(): {
    totalRules: number
    enabledRules: number
    rulesBySeverity: Record<AlertSeverity, number>
    rulesWithEscalation: number
  } {
    const allRules = Array.from(this.alertRules.values())
    
    return {
      totalRules: allRules.length,
      enabledRules: allRules.filter(r => r.enabled).length,
      rulesBySeverity: {
        low: allRules.filter(r => r.severity === 'low').length,
        medium: allRules.filter(r => r.severity === 'medium').length,
        high: allRules.filter(r => r.severity === 'high').length,
        critical: allRules.filter(r => r.severity === 'critical').length
      },
      rulesWithEscalation: allRules.filter(r => r.escalationRules.length > 0).length
    }
  }
}