/**
 * Notification channel management and message delivery
 */

import { NotificationChannel, UnifiedAlert, NotificationPayload } from './types'
import { NotificationTemplates } from './NotificationTemplates'
import { AlertingConfigManager } from './config'

export class NotificationDispatcher {
  private notificationChannels: Map<string, NotificationChannel> = new Map()
  private templates: NotificationTemplates
  private configManager: AlertingConfigManager

  constructor(configManager?: AlertingConfigManager) {
    this.configManager = configManager || new AlertingConfigManager()
    this.templates = new NotificationTemplates()
    this.initializeNotificationChannels()
  }

  /**
   * Initialize notification channels from configuration
   */
  private initializeNotificationChannels(): void {
    const channels = this.configManager.getDefaultNotificationChannels()
    
    channels.forEach(channel => {
      this.notificationChannels.set(channel.id, channel)
    })

    console.log(`✅ Initialized ${channels.length} notification channels`)
  }

  /**
   * Send notifications through specified channels
   */
  async sendNotifications(
    alert: UnifiedAlert, 
    channelIds: string[], 
    escalationLevel: number = 0
  ): Promise<{ successful: string[]; failed: string[] }> {
    const successful: string[] = []
    const failed: string[] = []

    const payload = this.templates.buildNotificationPayload(alert, escalationLevel)

    for (const channelId of channelIds) {
      const channel = this.notificationChannels.get(channelId)
      if (!channel || !channel.enabled) {
        console.warn(`Channel ${channelId} not found or disabled`)
        failed.push(channelId)
        continue
      }

      try {
        await this.sendNotification(channel, payload)
        this.updateChannelSuccess(channel)
        successful.push(channelId)
        console.log(`✅ Notification sent via ${channelId}`)
      } catch (error) {
        console.error(`❌ Failed to send notification via ${channelId}:`, error)
        this.updateChannelFailure(channel, error)
        failed.push(channelId)
      }
    }

    return { successful, failed }
  }

  /**
   * Send notification to a specific channel
   */
  async sendNotification(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    switch (channel.type) {
      case 'slack':
        await this.sendSlackNotification(channel, payload)
        break
      case 'webhook':
        await this.sendWebhookNotification(channel, payload)
        break
      case 'email':
        await this.sendEmailNotification(channel, payload)
        break
      case 'discord':
        await this.sendDiscordNotification(channel, payload)
        break
      case 'teams':
        await this.sendTeamsNotification(channel, payload)
        break
      case 'pagerduty':
        await this.sendPagerDutyNotification(channel, payload)
        break
      default:
        // Console fallback
        await this.sendConsoleNotification(channel, payload)
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    if (!channel.config.token) {
      throw new Error('Slack token not configured')
    }

    const slackMessage = this.templates.buildSlackMessage(payload)

    // In production, use the Slack Web API
    if (process.env.NODE_ENV === 'production' && channel.config.token) {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${channel.config.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: channel.config.channel,
          ...slackMessage
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Slack API error: ${error}`)
      }

      const result = await response.json()
      if (!result.ok) {
        throw new Error(`Slack API error: ${result.error}`)
      }
    } else {
      // Development fallback
      console.log('📱 [DEV] Slack notification:', JSON.stringify(slackMessage, null, 2))
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    if (!channel.config.url) {
      throw new Error('Webhook URL not configured')
    }

    const webhookPayload = this.templates.buildWebhookPayload(payload)

    if (channel.id === 'console') {
      // Special case for console logging
      console.log('🚨 ALERT NOTIFICATION:', this.templates.buildConsoleMessage(payload))
      return
    }

    // Send HTTP POST request to webhook URL
    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(channel.config.headers || {})
      },
      body: JSON.stringify(webhookPayload)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Webhook error (${response.status}): ${error}`)
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    if (!channel.config.email) {
      throw new Error('Email address not configured')
    }

    const emailContent = this.templates.buildEmailContent(payload)

    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    if (process.env.NODE_ENV === 'production') {
      // Example with SendGrid
      if (process.env.SENDGRID_API_KEY) {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            personalizations: [{
              to: [{ email: channel.config.email }]
            }],
            from: { email: process.env.FROM_EMAIL || 'alerts@voicememory.com' },
            subject: emailContent.subject,
            content: [
              { type: 'text/plain', value: emailContent.text },
              { type: 'text/html', value: emailContent.html }
            ]
          })
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`SendGrid error: ${error}`)
        }
      } else {
        throw new Error('Email service not configured')
      }
    } else {
      // Development fallback
      console.log('📧 [DEV] Email notification:')
      console.log(`To: ${channel.config.email}`)
      console.log(`Subject: ${emailContent.subject}`)
      console.log(`Body: ${emailContent.text}`)
    }
  }

  /**
   * Send Discord notification
   */
  private async sendDiscordNotification(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    if (!channel.config.url) {
      throw new Error('Discord webhook URL not configured')
    }

    const discordMessage = this.templates.buildDiscordMessage(payload)

    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(discordMessage)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Discord webhook error (${response.status}): ${error}`)
    }
  }

  /**
   * Send Teams notification
   */
  private async sendTeamsNotification(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    if (!channel.config.url) {
      throw new Error('Teams webhook URL not configured')
    }

    const teamsMessage = this.templates.buildTeamsMessage(payload)

    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(teamsMessage)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Teams webhook error (${response.status}): ${error}`)
    }
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    if (!process.env.PAGERDUTY_ROUTING_KEY) {
      throw new Error('PagerDuty routing key not configured')
    }

    const pagerDutyEvent = this.templates.buildPagerDutyEvent(payload)

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pagerDutyEvent)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`PagerDuty error (${response.status}): ${error}`)
    }

    const result = await response.json()
    if (result.status !== 'success') {
      throw new Error(`PagerDuty API error: ${result.message}`)
    }
  }

  /**
   * Send console notification (fallback)
   */
  private async sendConsoleNotification(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    console.log(this.templates.buildConsoleMessage(payload))
  }

  /**
   * Update channel on successful delivery
   */
  private updateChannelSuccess(channel: NotificationChannel): void {
    channel.lastSuccess = new Date().toISOString()
    channel.failureCount = 0
  }

  /**
   * Update channel on failed delivery
   */
  private updateChannelFailure(channel: NotificationChannel, error: any): void {
    channel.failureCount++
    channel.lastFailure = new Date().toISOString()

    // Store error details for debugging
    if (!channel.config.lastErrors) {
      channel.config.lastErrors = []
    }
    channel.config.lastErrors.unshift({
      timestamp: new Date().toISOString(),
      error: error.message || String(error)
    })

    // Keep only last 10 errors
    if (channel.config.lastErrors.length > 10) {
      channel.config.lastErrors = channel.config.lastErrors.slice(0, 10)
    }
  }

  /**
   * Add or update notification channel
   */
  addChannel(channel: NotificationChannel): void {
    this.notificationChannels.set(channel.id, { ...channel })
    console.log(`📢 Notification channel added/updated: ${channel.name}`)
  }

  /**
   * Remove notification channel
   */
  removeChannel(channelId: string): boolean {
    const channel = this.notificationChannels.get(channelId)
    if (channel) {
      this.notificationChannels.delete(channelId)
      console.log(`🗑️ Notification channel removed: ${channel.name}`)
      return true
    }
    return false
  }

  /**
   * Get notification channel by ID
   */
  getChannel(channelId: string): NotificationChannel | null {
    const channel = this.notificationChannels.get(channelId)
    return channel ? { ...channel } : null
  }

  /**
   * Get all notification channels
   */
  getAllChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values()).map(channel => ({ ...channel }))
  }

  /**
   * Get enabled notification channels
   */
  getEnabledChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values())
      .filter(channel => channel.enabled)
      .map(channel => ({ ...channel }))
  }

  /**
   * Enable or disable a channel
   */
  setChannelEnabled(channelId: string, enabled: boolean): boolean {
    const channel = this.notificationChannels.get(channelId)
    if (channel) {
      channel.enabled = enabled
      console.log(`${enabled ? '✅' : '❌'} Channel ${enabled ? 'enabled' : 'disabled'}: ${channel.name}`)
      return true
    }
    return false
  }

  /**
   * Test notification channel
   */
  async testChannel(channelId: string): Promise<boolean> {
    const channel = this.notificationChannels.get(channelId)
    if (!channel) {
      console.error(`Channel not found: ${channelId}`)
      return false
    }

    try {
      const testPayload = this.templates.buildTestMessage(channel.type)
      await this.sendNotification(channel, testPayload)
      
      this.updateChannelSuccess(channel)
      console.log(`✅ Test notification sent successfully via ${channelId}`)
      return true
    } catch (error) {
      console.error(`❌ Test notification failed for channel ${channelId}:`, error)
      this.updateChannelFailure(channel, error)
      return false
    }
  }

  /**
   * Get channel health status
   */
  getChannelHealth(): Array<{
    channelId: string
    name: string
    type: string
    enabled: boolean
    isHealthy: boolean
    failureCount: number
    lastSuccess?: string
    lastFailure?: string
  }> {
    return Array.from(this.notificationChannels.values()).map(channel => ({
      channelId: channel.id,
      name: channel.name,
      type: channel.type,
      enabled: channel.enabled,
      isHealthy: channel.enabled && channel.failureCount < 3,
      failureCount: channel.failureCount,
      lastSuccess: channel.lastSuccess,
      lastFailure: channel.lastFailure
    }))
  }

  /**
   * Reset channel failure count
   */
  resetChannelFailures(channelId: string): boolean {
    const channel = this.notificationChannels.get(channelId)
    if (channel) {
      channel.failureCount = 0
      channel.lastFailure = undefined
      if (channel.config.lastErrors) {
        delete channel.config.lastErrors
      }
      console.log(`🔄 Reset failure count for channel: ${channel.name}`)
      return true
    }
    return false
  }
}