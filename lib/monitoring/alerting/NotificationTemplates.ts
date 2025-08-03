/**
 * Notification message templates and formatting
 */

import { UnifiedAlert, NotificationPayload, AlertSeverity } from './types'
import { getSeverityColor, getSeverityEmoji, formatDuration } from './utils'

export class NotificationTemplates {
  /**
   * Build notification payload from alert
   */
  buildNotificationPayload(alert: UnifiedAlert, escalationLevel: number): NotificationPayload {
    return {
      id: alert.id,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      type: alert.type,
      source: alert.source,
      timestamp: alert.timestamp,
      escalationLevel,
      details: alert.details,
      affectedResources: alert.affectedResources,
      recommendations: alert.recommendations,
      tags: alert.tags
    }
  }

  /**
   * Build Slack message format
   */
  buildSlackMessage(payload: NotificationPayload): any {
    const emoji = getSeverityEmoji(payload.severity)
    const color = getSeverityColor(payload.severity)
    const escalationText = payload.escalationLevel > 0 ? ` (Escalation Level ${payload.escalationLevel})` : ''
    
    return {
      text: `${emoji} ${payload.title}${escalationText}`,
      attachments: [{
        color,
        title: payload.title,
        text: payload.message,
        fields: [
          { title: 'Severity', value: payload.severity.toUpperCase(), short: true },
          { title: 'Type', value: payload.type, short: true },
          { title: 'Source', value: payload.source, short: true },
          { title: 'Time', value: new Date(payload.timestamp).toLocaleString(), short: true },
          ...(payload.affectedResources.length > 0 ? [{
            title: 'Affected Resources',
            value: payload.affectedResources.join(', '),
            short: false
          }] : []),
          ...(payload.recommendations.length > 0 ? [{
            title: 'Recommendations',
            value: payload.recommendations.map(r => `• ${r}`).join('\n'),
            short: false
          }] : [])
        ],
        footer: 'Voice Memory Alerts',
        ts: Math.floor(new Date(payload.timestamp).getTime() / 1000)
      }]
    }
  }

  /**
   * Build webhook payload
   */
  buildWebhookPayload(payload: NotificationPayload): any {
    return {
      alert: {
        id: payload.id,
        title: payload.title,
        message: payload.message,
        severity: payload.severity,
        type: payload.type,
        source: payload.source,
        timestamp: payload.timestamp,
        escalationLevel: payload.escalationLevel
      },
      details: payload.details,
      affectedResources: payload.affectedResources,
      recommendations: payload.recommendations,
      tags: payload.tags,
      metadata: {
        system: 'voice-memory',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    }
  }

  /**
   * Build email content
   */
  buildEmailContent(payload: NotificationPayload): { subject: string; html: string; text: string } {
    const emoji = getSeverityEmoji(payload.severity)
    const escalationText = payload.escalationLevel > 0 ? ` (Escalation Level ${payload.escalationLevel})` : ''
    
    const subject = `${emoji} [${payload.severity.toUpperCase()}] ${payload.title}${escalationText}`
    
    const html = this.buildEmailHTML(payload)
    const text = this.buildEmailText(payload)
    
    return { subject, html, text }
  }

  /**
   * Build HTML email content
   */
  private buildEmailHTML(payload: NotificationPayload): string {
    const color = getSeverityColor(payload.severity)
    const emoji = getSeverityEmoji(payload.severity)
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Voice Memory Alert</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: ${color}; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .severity { display: inline-block; padding: 4px 8px; border-radius: 4px; font-weight: bold; color: white; background: ${color}; }
            .field { margin: 10px 0; }
            .field-label { font-weight: bold; color: #555; }
            .field-value { margin-top: 5px; }
            .recommendations { background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .recommendations ul { margin: 0; padding-left: 20px; }
            .footer { background: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${emoji} Voice Memory Alert</h1>
            </div>
            <div class="content">
              <div class="field">
                <div class="field-label">Alert:</div>
                <div class="field-value"><strong>${payload.title}</strong></div>
              </div>
              
              <div class="field">
                <div class="field-label">Message:</div>
                <div class="field-value">${payload.message}</div>
              </div>
              
              <div class="field">
                <div class="field-label">Severity:</div>
                <div class="field-value"><span class="severity">${payload.severity.toUpperCase()}</span></div>
              </div>
              
              <div class="field">
                <div class="field-label">Type:</div>
                <div class="field-value">${payload.type}</div>
              </div>
              
              <div class="field">
                <div class="field-label">Source:</div>
                <div class="field-value">${payload.source}</div>
              </div>
              
              <div class="field">
                <div class="field-label">Timestamp:</div>
                <div class="field-value">${new Date(payload.timestamp).toLocaleString()}</div>
              </div>
              
              ${payload.escalationLevel > 0 ? `
                <div class="field">
                  <div class="field-label">Escalation Level:</div>
                  <div class="field-value">${payload.escalationLevel}</div>
                </div>
              ` : ''}
              
              ${payload.affectedResources.length > 0 ? `
                <div class="field">
                  <div class="field-label">Affected Resources:</div>
                  <div class="field-value">${payload.affectedResources.join(', ')}</div>
                </div>
              ` : ''}
              
              ${payload.recommendations.length > 0 ? `
                <div class="recommendations">
                  <div class="field-label">Recommendations:</div>
                  <ul>
                    ${payload.recommendations.map(r => `<li>${r}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
            <div class="footer">
              Voice Memory Alerting System<br>
              Alert ID: ${payload.id}
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Build plain text email content
   */
  private buildEmailText(payload: NotificationPayload): string {
    const lines = [
      `VOICE MEMORY ALERT`,
      `===================`,
      ``,
      `Alert: ${payload.title}`,
      `Message: ${payload.message}`,
      `Severity: ${payload.severity.toUpperCase()}`,
      `Type: ${payload.type}`,
      `Source: ${payload.source}`,
      `Timestamp: ${new Date(payload.timestamp).toLocaleString()}`,
    ]

    if (payload.escalationLevel > 0) {
      lines.push(`Escalation Level: ${payload.escalationLevel}`)
    }

    if (payload.affectedResources.length > 0) {
      lines.push(`Affected Resources: ${payload.affectedResources.join(', ')}`)
    }

    if (payload.recommendations.length > 0) {
      lines.push(``)
      lines.push(`Recommendations:`)
      payload.recommendations.forEach(rec => {
        lines.push(`• ${rec}`)
      })
    }

    lines.push(``)
    lines.push(`Alert ID: ${payload.id}`)
    lines.push(`Voice Memory Alerting System`)

    return lines.join('\n')
  }

  /**
   * Build console log message
   */
  buildConsoleMessage(payload: NotificationPayload): string {
    const emoji = getSeverityEmoji(payload.severity)
    const escalationText = payload.escalationLevel > 0 ? ` [L${payload.escalationLevel}]` : ''
    
    return `${emoji} [${payload.severity.toUpperCase()}]${escalationText} ${payload.title} - ${payload.message} (${payload.source})`
  }

  /**
   * Build Discord message format
   */
  buildDiscordMessage(payload: NotificationPayload): any {
    const color = parseInt(getSeverityColor(payload.severity).replace('#', ''), 16)
    const emoji = getSeverityEmoji(payload.severity)
    
    return {
      embeds: [{
        title: `${emoji} ${payload.title}`,
        description: payload.message,
        color,
        fields: [
          { name: 'Severity', value: payload.severity.toUpperCase(), inline: true },
          { name: 'Type', value: payload.type, inline: true },
          { name: 'Source', value: payload.source, inline: true },
          ...(payload.escalationLevel > 0 ? [{
            name: 'Escalation Level',
            value: payload.escalationLevel.toString(),
            inline: true
          }] : []),
          ...(payload.affectedResources.length > 0 ? [{
            name: 'Affected Resources',
            value: payload.affectedResources.join(', '),
            inline: false
          }] : []),
          ...(payload.recommendations.length > 0 ? [{
            name: 'Recommendations',
            value: payload.recommendations.map(r => `• ${r}`).join('\n'),
            inline: false
          }] : [])
        ],
        timestamp: payload.timestamp,
        footer: {
          text: `Voice Memory Alerts • ${payload.id}`
        }
      }]
    }
  }

  /**
   * Build Teams message format
   */
  buildTeamsMessage(payload: NotificationPayload): any {
    const color = getSeverityColor(payload.severity)
    const emoji = getSeverityEmoji(payload.severity)
    
    return {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": color,
      "summary": `${payload.title}`,
      "sections": [{
        "activityTitle": `${emoji} ${payload.title}`,
        "activitySubtitle": `Voice Memory Alert - ${payload.severity.toUpperCase()}`,
        "text": payload.message,
        "facts": [
          { "name": "Severity", "value": payload.severity.toUpperCase() },
          { "name": "Type", "value": payload.type },
          { "name": "Source", "value": payload.source },
          { "name": "Timestamp", "value": new Date(payload.timestamp).toLocaleString() },
          ...(payload.escalationLevel > 0 ? [{
            "name": "Escalation Level",
            "value": payload.escalationLevel.toString()
          }] : []),
          ...(payload.affectedResources.length > 0 ? [{
            "name": "Affected Resources",
            "value": payload.affectedResources.join(', ')
          }] : [])
        ]
      }],
      ...(payload.recommendations.length > 0 ? {
        "sections": [{
          "title": "Recommendations",
          "text": payload.recommendations.map(r => `• ${r}`).join('<br>')
        }]
      } : {})
    }
  }

  /**
   * Build PagerDuty event format
   */
  buildPagerDutyEvent(payload: NotificationPayload): any {
    return {
      routing_key: process.env.PAGERDUTY_ROUTING_KEY,
      event_action: "trigger",
      dedup_key: payload.id,
      payload: {
        summary: `${payload.title}`,
        source: payload.source,
        severity: this.mapSeverityToPagerDuty(payload.severity),
        component: "voice-memory",
        group: payload.type,
        class: payload.type,
        custom_details: {
          message: payload.message,
          escalation_level: payload.escalationLevel,
          affected_resources: payload.affectedResources,
          recommendations: payload.recommendations,
          tags: payload.tags,
          alert_id: payload.id
        }
      }
    }
  }

  /**
   * Map alert severity to PagerDuty severity
   */
  private mapSeverityToPagerDuty(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return 'critical'
      case 'high': return 'error'
      case 'medium': return 'warning'
      case 'low': return 'info'
      default: return 'info'
    }
  }

  /**
   * Build test notification message
   */
  buildTestMessage(channelType: string): NotificationPayload {
    return {
      id: 'test-alert',
      title: 'Test Alert',
      message: `This is a test notification from Voice Memory alerting system via ${channelType}`,
      severity: 'low',
      type: 'system',
      source: 'alerting-test',
      timestamp: new Date().toISOString(),
      escalationLevel: 0,
      details: { test: true },
      affectedResources: [],
      recommendations: ['This is a test - no action required'],
      tags: ['test']
    }
  }
}