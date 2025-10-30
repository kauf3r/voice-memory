/**
 * Channel health monitoring and testing
 */

import { NotificationChannel, ChannelHealth } from './types'
import { NotificationTemplates } from './NotificationTemplates'

export class ChannelHealthMonitor {
  private channelHealth: Map<string, ChannelHealth> = new Map()
  private templates: NotificationTemplates
  private healthCheckInterval: NodeJS.Timeout | null = null
  private readonly HEALTH_CHECK_INTERVAL_MINUTES = 15
  private readonly MAX_CONSECUTIVE_FAILURES = 3
  private readonly HEALTH_CHECK_TIMEOUT_MS = 10000

  constructor() {
    this.templates = new NotificationTemplates()
  }

  /**
   * Start health monitoring for channels
   */
  startHealthMonitoring(channels: NotificationChannel[]): void {
    // Initialize health status for all channels
    channels.forEach(channel => {
      this.initializeChannelHealth(channel)
    })

    // Start periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks(channels)
    }, this.HEALTH_CHECK_INTERVAL_MINUTES * 60 * 1000)

    console.log(`🩺 Channel health monitoring started (${this.HEALTH_CHECK_INTERVAL_MINUTES}min intervals)`)
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
      console.log('🛑 Channel health monitoring stopped')
    }
  }

  /**
   * Initialize health status for a channel
   */
  private initializeChannelHealth(channel: NotificationChannel): void {
    const health: ChannelHealth = {
      channelId: channel.id,
      isHealthy: channel.enabled,
      lastCheck: new Date().toISOString(),
      errorCount: channel.failureCount || 0,
      responseTime: undefined,
      lastError: undefined
    }

    this.channelHealth.set(channel.id, health)
  }

  /**
   * Perform health checks on all channels
   */
  private async performHealthChecks(channels: NotificationChannel[]): Promise<void> {
    const enabledChannels = channels.filter(channel => channel.enabled)
    
    console.log(`🔍 Performing health checks on ${enabledChannels.length} channels`)

    const healthCheckPromises = enabledChannels.map(channel => 
      this.checkChannelHealth(channel)
    )

    const results = await Promise.allSettled(healthCheckPromises)
    
    let healthyCount = 0
    let unhealthyCount = 0

    results.forEach((result, index) => {
      const channel = enabledChannels[index]
      if (result.status === 'fulfilled' && result.value) {
        healthyCount++
      } else {
        unhealthyCount++
        console.warn(`❌ Health check failed for channel ${channel.id}:`, 
          result.status === 'rejected' ? result.reason : 'Check returned false')
      }
    })

    console.log(`📊 Health check complete: ${healthyCount} healthy, ${unhealthyCount} unhealthy`)
  }

  /**
   * Check health of a specific channel
   */
  async checkChannelHealth(channel: NotificationChannel): Promise<boolean> {
    const startTime = Date.now()
    let health = this.channelHealth.get(channel.id)

    if (!health) {
      this.initializeChannelHealth(channel)
      health = this.channelHealth.get(channel.id)!
    }

    try {
      const success = await this.performChannelTest(channel)
      const responseTime = Date.now() - startTime

      if (success) {
        health.isHealthy = true
        health.errorCount = 0
        health.responseTime = responseTime
        health.lastError = undefined
        
        console.log(`✅ Channel ${channel.id} health check passed (${responseTime}ms)`)
      } else {
        health.errorCount++
        health.isHealthy = health.errorCount < this.MAX_CONSECUTIVE_FAILURES
        health.lastError = 'Health check failed'
        
        console.warn(`⚠️ Channel ${channel.id} health check failed (${health.errorCount} consecutive failures)`)
      }

      health.lastCheck = new Date().toISOString()
      return success
    } catch (error) {
      const responseTime = Date.now() - startTime
      
      health.errorCount++
      health.isHealthy = health.errorCount < this.MAX_CONSECUTIVE_FAILURES
      health.responseTime = responseTime
      health.lastError = error instanceof Error ? error.message : String(error)
      health.lastCheck = new Date().toISOString()

      console.error(`❌ Channel ${channel.id} health check error:`, error)
      return false
    }
  }

  /**
   * Perform actual test on a channel
   */
  private async performChannelTest(channel: NotificationChannel): Promise<boolean> {
    const testPayload = this.templates.buildTestMessage(`${channel.type} (health check)`)

    switch (channel.type) {
      case 'slack':
        return await this.testSlackChannel(channel, testPayload)
      case 'webhook':
        return await this.testWebhookChannel(channel, testPayload)
      case 'email':
        return await this.testEmailChannel(channel, testPayload)
      case 'discord':
        return await this.testDiscordChannel(channel, testPayload)
      case 'teams':
        return await this.testTeamsChannel(channel, testPayload)
      case 'pagerduty':
        return await this.testPagerDutyChannel(channel, testPayload)
      default:
        // Console channels are always healthy
        return true
    }
  }

  /**
   * Test Slack channel health
   */
  private async testSlackChannel(channel: NotificationChannel, testPayload: any): Promise<boolean> {
    if (!channel.config.token) {
      return false
    }

    try {
      // Use a lightweight API call for health check
      const response = await this.fetchWithTimeout('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${channel.config.token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        return false
      }

      const result = await response.json()
      return result.ok === true
    } catch (error) {
      return false
    }
  }

  /**
   * Test webhook channel health
   */
  private async testWebhookChannel(channel: NotificationChannel, testPayload: any): Promise<boolean> {
    if (!channel.config.url || channel.id === 'console') {
      return true // Console is always healthy
    }

    try {
      const webhookPayload = this.templates.buildWebhookPayload(testPayload)
      
      const response = await this.fetchWithTimeout(channel.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VoiceMemory-HealthCheck/1.0',
          ...(channel.config.headers || {})
        },
        body: JSON.stringify({
          ...webhookPayload,
          healthCheck: true
        })
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Test email channel health
   */
  private async testEmailChannel(channel: NotificationChannel, testPayload: any): Promise<boolean> {
    if (!channel.config.email) {
      return false
    }

    // For email, we can only validate the configuration
    // Actual sending would require email service integration
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(channel.config.email)
    
    if (!isValidEmail) {
      return false
    }

    // If SendGrid is configured, test the API
    if (process.env.SENDGRID_API_KEY) {
      try {
        const response = await this.fetchWithTimeout('https://api.sendgrid.com/v3/user/profile', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`
          }
        })

        return response.ok
      } catch (error) {
        return false
      }
    }

    return true // Assume healthy if email format is valid
  }

  /**
   * Test Discord channel health
   */
  private async testDiscordChannel(channel: NotificationChannel, testPayload: any): Promise<boolean> {
    if (!channel.config.url) {
      return false
    }

    try {
      // Send a minimal webhook payload to test connectivity
      const response = await this.fetchWithTimeout(channel.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: 'Health check - please ignore',
          username: 'VoiceMemory HealthCheck'
        })
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Test Teams channel health
   */
  private async testTeamsChannel(channel: NotificationChannel, testPayload: any): Promise<boolean> {
    if (!channel.config.url) {
      return false
    }

    try {
      const teamsMessage = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "summary": "Health Check",
        "text": "VoiceMemory health check - please ignore"
      }

      const response = await this.fetchWithTimeout(channel.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(teamsMessage)
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Test PagerDuty channel health
   */
  private async testPagerDutyChannel(channel: NotificationChannel, testPayload: any): Promise<boolean> {
    if (!process.env.PAGERDUTY_ROUTING_KEY) {
      return false
    }

    try {
      // Don't actually trigger an incident, just validate the endpoint
      const response = await this.fetchWithTimeout('https://events.pagerduty.com/health', {
        method: 'GET'
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Get health status for a specific channel
   */
  getChannelHealthStatus(channelId: string): ChannelHealth | null {
    const health = this.channelHealth.get(channelId)
    return health ? { ...health } : null
  }

  /**
   * Get health status for all channels
   */
  getAllChannelHealth(): ChannelHealth[] {
    return Array.from(this.channelHealth.values()).map(health => ({ ...health }))
  }

  /**
   * Get unhealthy channels
   */
  getUnhealthyChannels(): ChannelHealth[] {
    return Array.from(this.channelHealth.values())
      .filter(health => !health.isHealthy)
      .map(health => ({ ...health }))
  }

  /**
   * Get health summary
   */
  getHealthSummary(): {
    totalChannels: number
    healthyChannels: number
    unhealthyChannels: number
    averageResponseTime: number
    lastCheckTime: string
  } {
    const allHealth = Array.from(this.channelHealth.values())
    const healthyChannels = allHealth.filter(h => h.isHealthy)
    const channelsWithResponseTime = allHealth.filter(h => h.responseTime !== undefined)
    
    const averageResponseTime = channelsWithResponseTime.length > 0
      ? channelsWithResponseTime.reduce((sum, h) => sum + (h.responseTime || 0), 0) / channelsWithResponseTime.length
      : 0

    const lastCheckTime = allHealth.length > 0
      ? allHealth.reduce((latest, h) => 
          new Date(h.lastCheck).getTime() > new Date(latest).getTime() ? h.lastCheck : latest,
          allHealth[0].lastCheck
        )
      : new Date().toISOString()

    return {
      totalChannels: allHealth.length,
      healthyChannels: healthyChannels.length,
      unhealthyChannels: allHealth.length - healthyChannels.length,
      averageResponseTime: Math.round(averageResponseTime),
      lastCheckTime
    }
  }

  /**
   * Reset health status for a channel
   */
  resetChannelHealth(channelId: string): boolean {
    const health = this.channelHealth.get(channelId)
    if (health) {
      health.isHealthy = true
      health.errorCount = 0
      health.lastError = undefined
      health.lastCheck = new Date().toISOString()
      console.log(`🔄 Reset health status for channel: ${channelId}`)
      return true
    }
    return false
  }

  /**
   * Manually mark a channel as unhealthy
   */
  markChannelUnhealthy(channelId: string, error: string): void {
    let health = this.channelHealth.get(channelId)
    if (!health) {
      health = {
        channelId,
        isHealthy: false,
        lastCheck: new Date().toISOString(),
        errorCount: 1,
        lastError: error
      }
      this.channelHealth.set(channelId, health)
    } else {
      health.isHealthy = false
      health.errorCount++
      health.lastError = error
      health.lastCheck = new Date().toISOString()
    }

    console.warn(`⚠️ Marked channel ${channelId} as unhealthy: ${error}`)
  }

  /**
   * Test all channels immediately
   */
  async testAllChannels(channels: NotificationChannel[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>()
    
    console.log(`🔍 Testing ${channels.length} channels...`)

    for (const channel of channels) {
      if (channel.enabled) {
        try {
          const isHealthy = await this.checkChannelHealth(channel)
          results.set(channel.id, isHealthy)
        } catch (error) {
          console.error(`Error testing channel ${channel.id}:`, error)
          results.set(channel.id, false)
        }
      } else {
        results.set(channel.id, false)
      }
    }

    return results
  }

  /**
   * Get channel performance metrics
   */
  getChannelPerformanceMetrics(): Array<{
    channelId: string
    averageResponseTime: number
    successRate: number
    uptime: number
    lastError?: string
  }> {
    return Array.from(this.channelHealth.values()).map(health => {
      const successRate = health.errorCount === 0 ? 100 : 
        Math.max(0, 100 - (health.errorCount * 10)) // Rough calculation

      return {
        channelId: health.channelId,
        averageResponseTime: health.responseTime || 0,
        successRate,
        uptime: health.isHealthy ? 100 : 0, // Simplified uptime
        lastError: health.lastError
      }
    })
  }
}