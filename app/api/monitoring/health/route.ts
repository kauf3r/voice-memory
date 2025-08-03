/**
 * Database Health Monitoring API Endpoint
 * 
 * Provides real-time database health metrics and monitoring data
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { DatabaseHealthMonitor } from '@/lib/monitoring/DatabaseHealthMonitor'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Singleton health monitor instance
let healthMonitor: DatabaseHealthMonitor | null = null

function getHealthMonitor(): DatabaseHealthMonitor {
  if (!healthMonitor) {
    healthMonitor = new DatabaseHealthMonitor()
    
    // Start monitoring if enabled in config
    const config = getConfig()
    if (config.monitoring.enableMetrics) {
      healthMonitor.startMonitoring()
    }
  }
  
  return healthMonitor
}

/**
 * GET /api/monitoring/health
 * Get current database health status
 */
export async function GET(request: NextRequest) {
  console.log('🔍 Health monitoring API - GET request')
  
  try {
    // Check authentication for monitoring endpoints
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
    const action = url.searchParams.get('action') || 'current'
    const limit = parseInt(url.searchParams.get('limit') || '10')

    const monitor = getHealthMonitor()

    switch (action) {
      case 'current':
        // Get current health status
        const currentHealth = monitor.getCurrentHealth()
        if (!currentHealth) {
          // Perform health check if no current data
          const health = await monitor.performHealthCheck()
          return NextResponse.json({
            success: true,
            data: health,
            message: 'Health check performed'
          })
        }
        
        return NextResponse.json({
          success: true,
          data: currentHealth
        })

      case 'history':
        // Get health history
        const history = monitor.getHealthHistory(limit)
        return NextResponse.json({
          success: true,
          data: history,
          count: history.length
        })

      case 'alerts':
        // Get alerts
        const activeOnly = url.searchParams.get('active') === 'true'
        const alerts = activeOnly ? monitor.getActiveAlerts() : monitor.getAllAlerts(limit)
        return NextResponse.json({
          success: true,
          data: alerts,
          count: alerts.length
        })

      case 'status':
        // Get monitoring status
        const status = monitor.getMonitoringStatus()
        return NextResponse.json({
          success: true,
          data: status
        })

      case 'check':
        // Force a health check
        const freshHealth = await monitor.performHealthCheck()
        return NextResponse.json({
          success: true,
          data: freshHealth,
          message: 'Health check performed'
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Error in health monitoring API:', error)
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
 * POST /api/monitoring/health
 * Control health monitoring (start/stop/configure)
 */
export async function POST(request: NextRequest) {
  console.log('🔍 Health monitoring API - POST request')
  
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

    const monitor = getHealthMonitor()

    switch (action) {
      case 'start':
        monitor.startMonitoring()
        return NextResponse.json({
          success: true,
          message: 'Health monitoring started'
        })

      case 'stop':
        monitor.stopMonitoring()
        return NextResponse.json({
          success: true,
          message: 'Health monitoring stopped'
        })

      case 'resolve_alert':
        const { alertId } = params
        if (!alertId) {
          return NextResponse.json(
            { error: 'Alert ID is required' },
            { status: 400 }
          )
        }
        
        const resolved = monitor.resolveAlert(alertId)
        if (resolved) {
          return NextResponse.json({
            success: true,
            message: 'Alert resolved'
          })
        } else {
          return NextResponse.json(
            { error: 'Alert not found' },
            { status: 404 }
          )
        }

      case 'force_check':
        const health = await monitor.performHealthCheck()
        return NextResponse.json({
          success: true,
          data: health,
          message: 'Health check performed'
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Error in health monitoring POST API:', error)
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
 * PUT /api/monitoring/health
 * Update monitoring configuration
 */
export async function PUT(request: NextRequest) {
  console.log('🔍 Health monitoring API - PUT request')
  
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
    const { configuration } = body

    // For now, configuration updates would require app restart
    // In a production system, you might implement dynamic config updates
    console.log('📝 Health monitoring configuration update requested:', configuration)
    
    return NextResponse.json({
      success: true,
      message: 'Configuration update noted (requires restart to take effect)',
      data: configuration
    })

  } catch (error) {
    console.error('❌ Error in health monitoring PUT API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        success: false
      },
      { status: 500 }
    )
  }
}

// Health check endpoint for external monitoring services (no auth required)
export async function HEAD() {
  try {
    const monitor = getHealthMonitor()
    const currentHealth = monitor.getCurrentHealth()
    
    if (!currentHealth || currentHealth.status === 'critical') {
      return new NextResponse(null, { status: 503 }) // Service Unavailable
    }
    
    if (currentHealth.status === 'unhealthy') {
      return new NextResponse(null, { status: 500 }) // Internal Server Error
    }
    
    if (currentHealth.status === 'degraded') {
      return new NextResponse(null, { status: 202 }) // Accepted (degraded)
    }
    
    return new NextResponse(null, { status: 200 }) // OK
    
  } catch (error) {
    return new NextResponse(null, { status: 503 }) // Service Unavailable
  }
}