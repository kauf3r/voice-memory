/**
 * Performance Metrics API Endpoint
 * 
 * Provides access to detailed processing performance metrics and analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { PerformanceMetricsTracker } from '@/lib/monitoring/PerformanceMetricsTracker'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Singleton performance tracker instance
let performanceTracker: PerformanceMetricsTracker | null = null

function getPerformanceTracker(): PerformanceMetricsTracker {
  if (!performanceTracker) {
    performanceTracker = new PerformanceMetricsTracker()
  }
  return performanceTracker
}

/**
 * GET /api/monitoring/performance
 * Get performance metrics and analytics
 */
export async function GET(request: NextRequest) {
  console.log('📊 Performance metrics API - GET request')
  
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
    const action = url.searchParams.get('action') || 'analytics'
    const limit = parseInt(url.searchParams.get('limit') || '100')

    const tracker = getPerformanceTracker()

    switch (action) {
      case 'analytics':
        // Get comprehensive performance analytics
        const analytics = tracker.getPerformanceAnalytics()
        return NextResponse.json({
          success: true,
          data: analytics
        })

      case 'alerts':
        // Get performance alerts
        const activeOnly = url.searchParams.get('active') === 'true'
        const alerts = activeOnly ? tracker.getPerformanceAlerts() : tracker.getPerformanceAlerts()
        return NextResponse.json({
          success: true,
          data: alerts,
          count: alerts.length
        })

      case 'status':
        // Get tracking status
        const status = tracker.getTrackingStatus()
        return NextResponse.json({
          success: true,
          data: status
        })

      case 'summary':
        // Get summarized performance data
        const analytics_summary = tracker.getPerformanceAnalytics()
        return NextResponse.json({
          success: true,
          data: {
            summary: analytics_summary.summary,
            bottlenecks: analytics_summary.bottlenecks,
            anomalies: analytics_summary.anomalies,
            alertCount: tracker.getPerformanceAlerts().length,
            trackingStatus: tracker.getTrackingStatus()
          }
        })

      case 'trends':
        // Get performance trends
        const trends = tracker.getPerformanceAnalytics().trends
        return NextResponse.json({
          success: true,
          data: trends
        })

      case 'file_types':
        // Get file type performance breakdown
        const fileTypes = tracker.getPerformanceAnalytics().fileTypes
        return NextResponse.json({
          success: true,
          data: fileTypes
        })

      case 'users':
        // Get user performance metrics
        const users = tracker.getPerformanceAnalytics().users
        return NextResponse.json({
          success: true,
          data: users
        })

      case 'bottlenecks':
        // Get identified bottlenecks
        const bottlenecks = tracker.getPerformanceAnalytics().bottlenecks
        return NextResponse.json({
          success: true,
          data: bottlenecks
        })

      case 'anomalies':
        // Get detected anomalies
        const anomalies = tracker.getPerformanceAnalytics().anomalies
        return NextResponse.json({
          success: true,
          data: anomalies
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Error in performance metrics API:', error)
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
 * POST /api/monitoring/performance
 * Control performance tracking and resolve alerts
 */
export async function POST(request: NextRequest) {
  console.log('📊 Performance metrics API - POST request')
  
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

    const tracker = getPerformanceTracker()

    switch (action) {
      case 'resolve_alert':
        const { alertId } = params
        if (!alertId) {
          return NextResponse.json(
            { error: 'Alert ID is required' },
            { status: 400 }
          )
        }
        
        const resolved = tracker.resolvePerformanceAlert(alertId)
        if (resolved) {
          return NextResponse.json({
            success: true,
            message: 'Performance alert resolved'
          })
        } else {
          return NextResponse.json(
            { error: 'Alert not found' },
            { status: 404 }
          )
        }

      case 'clear_old_data':
        const { retentionHours = 24 } = params
        const removedCount = tracker.clearOldData(retentionHours)
        return NextResponse.json({
          success: true,
          message: `Cleared ${removedCount} old performance records`,
          removedCount
        })

      case 'generate_report':
        // Generate a comprehensive performance report
        const analytics = tracker.getPerformanceAnalytics()
        const status = tracker.getTrackingStatus()
        const alerts = tracker.getPerformanceAlerts()

        const report = {
          generatedAt: new Date().toISOString(),
          timeRange: {
            uptime: status.uptime,
            totalMetrics: status.totalHistorical
          },
          performance: analytics.summary,
          stages: analytics.stages,
          trends: analytics.trends,
          fileTypes: analytics.fileTypes,
          users: analytics.users,
          issues: {
            bottlenecks: analytics.bottlenecks,
            anomalies: analytics.anomalies,
            activeAlerts: alerts.length
          },
          recommendations: [
            ...analytics.bottlenecks.map(b => b.recommendation),
            ...(analytics.summary.averageProcessingTime > 60000 ? ['Consider optimizing overall processing pipeline'] : []),
            ...(analytics.summary.errorRate > 5 ? ['Investigate and address error patterns'] : []),
            ...(Object.keys(analytics.fileTypes).length > 5 ? ['Monitor file type processing efficiency'] : [])
          ].filter(Boolean)
        }

        return NextResponse.json({
          success: true,
          data: report
        })

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Error in performance metrics POST API:', error)
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
 * PUT /api/monitoring/performance
 * Update performance tracking configuration
 */
export async function PUT(request: NextRequest) {
  console.log('📊 Performance metrics API - PUT request')
  
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
    console.log('📝 Performance tracking configuration update requested:', configuration)
    
    return NextResponse.json({
      success: true,
      message: 'Configuration update noted (requires restart to take effect)',
      data: configuration
    })

  } catch (error) {
    console.error('❌ Error in performance metrics PUT API:', error)
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
 * DELETE /api/monitoring/performance
 * Clear performance data
 */
export async function DELETE(request: NextRequest) {
  console.log('📊 Performance metrics API - DELETE request')
  
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
    const dataType = url.searchParams.get('type') || 'old'
    const retentionHours = parseInt(url.searchParams.get('retention') || '24')

    const tracker = getPerformanceTracker()

    switch (dataType) {
      case 'old':
        // Clear old data beyond retention period
        const removedCount = tracker.clearOldData(retentionHours)
        return NextResponse.json({
          success: true,
          message: `Cleared ${removedCount} old performance records`,
          removedCount
        })

      case 'all':
        // This would require recreating the tracker instance
        // For now, just clear old data with 0 retention
        const allRemovedCount = tracker.clearOldData(0)
        return NextResponse.json({
          success: true,
          message: `Cleared all ${allRemovedCount} performance records`,
          removedCount: allRemovedCount
        })

      default:
        return NextResponse.json(
          { error: `Unknown data type: ${dataType}` },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Error in performance metrics DELETE API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        success: false
      },
      { status: 500 }
    )
  }
}

// Export the performance tracker for use by other parts of the application
export { getPerformanceTracker }