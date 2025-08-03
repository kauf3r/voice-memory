/**
 * Real-time Alerting API Endpoint
 * 
 * Provides access to the alerting system for managing alerts and notifications
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { AlertingService } from '@/lib/monitoring/AlertingService'
import { getConfig } from '@/lib/config/index'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Singleton alerting service instance
let alertingService: AlertingService | null = null

function getAlertingService(): AlertingService {
  if (!alertingService) {
    alertingService = new AlertingService()
    console.log('✅ Alerting service initialized')
  }
  return alertingService
}

/**
 * GET /api/monitoring/alerts
 * Get alerts with filtering and pagination
 */
export async function GET(request: NextRequest) {
  console.log('🚨 Alerting API - GET request')
  
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.split(' ')[1]
    const { user, error: authError } = await getAuthenticatedUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    // Get query parameters
    const url = new URL(request.url)
    const action = url.searchParams.get('action') || 'list'
    const status = url.searchParams.get('status') as any
    const severity = url.searchParams.get('severity') as any
    const type = url.searchParams.get('type') as any
    const limit = parseInt(url.searchParams.get('limit') || '50')

    const alertService = getAlertingService()

    switch (action) {
      case 'list':
        // Get alerts with filtering
        const alerts = alertService.getAlerts({
          status,
          severity,
          type,
          limit
        })
        
        return NextResponse.json({
          success: true,
          data: alerts,
          count: alerts.length
        })

      case 'active':
        // Get only active alerts
        const activeAlerts = alertService.getActiveAlerts()
        return NextResponse.json({
          success: true,
          data: activeAlerts,
          count: activeAlerts.length
        })

      case 'metrics':
        // Get alerting metrics
        const metrics = alertService.getMetrics()
        return NextResponse.json({
          success: true,
          data: metrics
        })

      case 'rules':
        // Get alert rules
        const rules = alertService.getAlertRules()
        return NextResponse.json({
          success: true,
          data: rules,
          count: rules.length
        })

      case 'channels':
        // Get notification channels
        const channels = alertService.getNotificationChannels()
        return NextResponse.json({
          success: true,
          data: channels,
          count: channels.length
        })

      case 'dashboard':
        // Get dashboard data
        const dashboardData = {
          summary: {
            activeAlerts: alertService.getActiveAlerts().length,
            totalAlerts: alertService.getMetrics().totalAlerts,
            criticalAlerts: alertService.getAlerts({ severity: 'critical', status: 'active' }).length,
            recentActivity: alertService.getMetrics().recentActivity.slice(0, 10)
          },
          alerts: alertService.getAlerts({ limit: 20 }),
          metrics: alertService.getMetrics()
        }
        
        return NextResponse.json({
          success: true,
          data: dashboardData
        })

      case 'health':
        // Get alerting system health
        const health = {
          isEnabled: getConfig().monitoring.alerting.enabled,
          activeAlerts: alertService.getActiveAlerts().length,
          channelStatus: alertService.getNotificationChannels().map(channel => ({
            id: channel.id,
            name: channel.name,
            enabled: channel.enabled,
            healthy: channel.failureCount < 3,
            lastSuccess: channel.lastSuccess
          })),
          uptime: Date.now() // Would track actual uptime in production
        }
        
        return NextResponse.json({
          success: true,
          data: health
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Error in alerting API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        success: false
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/monitoring/alerts
 * Create alerts, acknowledge, resolve, or test notifications
 */
export async function POST(request: NextRequest) {
  console.log('🚨 Alerting API - POST request')
  
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.split(' ')[1]
    const { user, error: authError } = await getAuthenticatedUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, ...params } = body

    const alertService = getAlertingService()

    switch (action) {
      case 'create':
        const { type, severity, title, message, details = {}, tags = [], affectedResources = [] } = params
        
        if (!type || !severity || !title || !message) {
          return NextResponse.json(
            { error: 'Missing required fields: type, severity, title, message' },
            { status: 400 }
          )
        }

        const newAlert = await alertService.createAlert(
          type,
          severity,
          title,
          message,
          details,
          'manual',
          tags,
          affectedResources
        )

        return NextResponse.json({
          success: true,
          data: newAlert,
          message: 'Alert created successfully'
        })

      case 'acknowledge':
        const { alertId: ackAlertId } = params
        if (!ackAlertId) {
          return NextResponse.json(
            { error: 'Alert ID is required' },
            { status: 400 }
          )
        }

        const acknowledged = await alertService.acknowledgeAlert(ackAlertId, user.email || user.id)
        if (acknowledged) {
          return NextResponse.json({
            success: true,
            message: 'Alert acknowledged'
          })
        } else {
          return NextResponse.json(
            { error: 'Alert not found or already acknowledged' },
            { status: 404 }
          )
        }

      case 'resolve':
        const { alertId: resolveAlertId } = params
        if (!resolveAlertId) {
          return NextResponse.json(
            { error: 'Alert ID is required' },
            { status: 400 }
          )
        }

        const resolved = await alertService.resolveAlert(resolveAlertId, user.email || user.id)
        if (resolved) {
          return NextResponse.json({
            success: true,
            message: 'Alert resolved'
          })
        } else {
          return NextResponse.json(
            { error: 'Alert not found or already resolved' },
            { status: 404 }
          )
        }

      case 'test_channel':
        const { channelId } = params
        if (!channelId) {
          return NextResponse.json(
            { error: 'Channel ID is required' },
            { status: 400 }
          )
        }

        const testResult = await alertService.testNotificationChannel(channelId)
        return NextResponse.json({
          success: testResult,
          message: testResult ? 'Test notification sent successfully' : 'Test notification failed'
        })

      case 'bulk_acknowledge':
        const { alertIds: bulkAckIds } = params
        if (!Array.isArray(bulkAckIds)) {
          return NextResponse.json(
            { error: 'Alert IDs array is required' },
            { status: 400 }
          )
        }

        const ackResults = await Promise.all(
          bulkAckIds.map(id => alertService.acknowledgeAlert(id, user.email || user.id))
        )
        const acknowledgedCount = ackResults.filter(Boolean).length

        return NextResponse.json({
          success: true,
          message: `${acknowledgedCount} of ${bulkAckIds.length} alerts acknowledged`,
          acknowledgedCount
        })

      case 'bulk_resolve':
        const { alertIds: bulkResolveIds } = params
        if (!Array.isArray(bulkResolveIds)) {
          return NextResponse.json(
            { error: 'Alert IDs array is required' },
            { status: 400 }
          )
        }

        const resolveResults = await Promise.all(
          bulkResolveIds.map(id => alertService.resolveAlert(id, user.email || user.id))
        )
        const resolvedCount = resolveResults.filter(Boolean).length

        return NextResponse.json({
          success: true,
          message: `${resolvedCount} of ${bulkResolveIds.length} alerts resolved`,
          resolvedCount
        })

      case 'simulate':
        // Create a test alert for demonstration
        const simulatedAlert = await alertService.createAlert(
          'system',
          'medium',
          'Simulated Alert',
          'This is a test alert created for demonstration purposes',
          { simulation: true, triggeredBy: user.email || user.id },
          'simulation',
          ['test', 'simulation'],
          ['system']
        )

        return NextResponse.json({
          success: true,
          data: simulatedAlert,
          message: 'Simulated alert created'
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Error in alerting POST API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        success: false
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/monitoring/alerts
 * Update alert rules or notification channels
 */
export async function PUT(request: NextRequest) {
  console.log('🚨 Alerting API - PUT request')
  
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.split(' ')[1]
    const { user, error: authError } = await getAuthenticatedUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { type, data } = body

    // For now, configuration updates would require service restart
    // In a production system, you might implement dynamic config updates
    console.log('📝 Alerting configuration update requested:', { type, data })
    
    return NextResponse.json({
      success: true,
      message: 'Configuration update noted (requires restart to take effect)',
      data: { type, data }
    })

  } catch (error) {
    console.error('❌ Error in alerting PUT API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        success: false
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/monitoring/alerts
 * Cleanup old alerts or suppress alerts
 */
export async function DELETE(request: NextRequest) {
  console.log('🚨 Alerting API - DELETE request')
  
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.split(' ')[1]
    const { user, error: authError } = await getAuthenticatedUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    // Get query parameters
    const url = new URL(request.url)
    const action = url.searchParams.get('action') || 'cleanup'
    const retentionHours = parseInt(url.searchParams.get('retention') || '24')

    const alertService = getAlertingService()

    switch (action) {
      case 'cleanup':
        // Clean up old resolved alerts
        const removedCount = alertService.cleanupOldAlerts(retentionHours)
        return NextResponse.json({
          success: true,
          message: `Cleaned up ${removedCount} old alerts`,
          removedCount
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Error in alerting DELETE API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        success: false
      },
      { status: 500 }
    )
  }
}

// Health check endpoint for alerting system (no auth required)
export async function HEAD() {
  try {
    const alertService = getAlertingService()
    const activeAlerts = alertService.getActiveAlerts()
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical')
    
    if (criticalAlerts.length > 0) {
      return new NextResponse(null, { status: 503 }) // Service Unavailable
    }
    
    const highAlerts = activeAlerts.filter(alert => alert.severity === 'high')
    if (highAlerts.length > 5) {
      return new NextResponse(null, { status: 500 }) // Internal Server Error
    }
    
    if (activeAlerts.length > 10) {
      return new NextResponse(null, { status: 202 }) // Accepted (degraded)
    }
    
    return new NextResponse(null, { status: 200 }) // OK
    
  } catch (error) {
    return new NextResponse(null, { status: 503 }) // Service Unavailable
  }
}

// Export the alerting service for use by other parts of the application
export { getAlertingService }