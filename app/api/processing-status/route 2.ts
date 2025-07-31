import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { performanceMonitor } from '@/lib/performance-monitor'
import { processingService } from '@/lib/processing-service'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const url = new URL(request.url)
    const includeInsights = url.searchParams.get('insights') === 'true'
    const includeCosts = url.searchParams.get('costs') === 'true'
    const days = parseInt(url.searchParams.get('days') || '7')

    // Get basic processing stats
    const processingStats = await processingService.getProcessingStats(user.id)
    
    // Get real-time status
    const currentStatus = performanceMonitor.getCurrentProcessingStatus()
    
    // Get circuit breaker status
    const circuitBreakerStatus = processingService.getCircuitBreakerStatus()
    
    // Get system health metrics
    const healthMetrics = await processingService.getSystemHealthMetrics()

    const response: any = {
      user: {
        id: user.id,
        processingStats,
        currentlyProcessing: currentStatus.activeJobs,
        averageQueueTime: currentStatus.averageQueueTime,
        recentErrors: currentStatus.recentErrors
      },
      system: {
        status: healthMetrics.healthStatus,
        load: currentStatus.systemLoad,
        circuitBreaker: circuitBreakerStatus,
        activeConnections: currentStatus.activeJobs
      },
      timestamp: new Date().toISOString()
    }

    // Add performance insights if requested
    if (includeInsights) {
      const insights = await performanceMonitor.getPerformanceInsights(user.id, days)
      response.insights = insights
    }

    // Add cost summary if requested
    if (includeCosts) {
      const costSummary = await performanceMonitor.getCostSummary(user.id, days)
      response.costs = costSummary
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Processing status API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Admin endpoint for system-wide metrics
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Check for admin authentication (simplified)
    const adminKey = request.headers.get('x-admin-key')
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, ...params } = body

    let result: any = {}

    switch (action) {
      case 'get_system_metrics':
        result = await processingService.getSystemHealthMetrics()
        break
        
      case 'get_performance_insights':
        result = await performanceMonitor.getPerformanceInsights(undefined, params.days || 7)
        break
        
      case 'get_cost_summary':
        result = await performanceMonitor.getCostSummary(undefined, params.days || 30)
        break
        
      case 'reset_circuit_breaker':
        // Reset circuit breaker (would need to implement this method)
        result = { message: 'Circuit breaker reset requested' }
        break
        
      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      action,
      result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Admin processing API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}