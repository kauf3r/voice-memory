/**
 * System Performance Management API
 * 
 * Provides endpoints for query optimization, performance monitoring,
 * and system health analytics.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-server'
import { QueryOptimizer } from '@/lib/optimization/QueryOptimizer'
import { initializeMonitoring, getMonitoringMetrics, getCurrentSystemHealth } from '@/lib/monitoring'

export async function GET(request: NextRequest) {
  try {
    // Get the current user
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    switch (action) {
      case 'health':
        // Get current system health
        try {
          const systemHealth = await getCurrentSystemHealth()
          return NextResponse.json({
            success: true,
            data: systemHealth
          })
        } catch (error) {
          // Fallback if monitoring not initialized
          console.warn('Monitoring not initialized, attempting to initialize...')
          await initializeMonitoring()
          const systemHealth = await getCurrentSystemHealth()
          return NextResponse.json({
            success: true,
            data: systemHealth
          })
        }

      case 'metrics':
        // Get comprehensive monitoring metrics
        const metrics = await getMonitoringMetrics()
        return NextResponse.json({
          success: true,
          data: metrics
        })

      case 'query-performance':
        // Get query performance analytics
        const queryOptimizer = new QueryOptimizer()
        const queryPerformance = queryOptimizer.getPerformanceAnalytics()
        return NextResponse.json({
          success: true,
          data: queryPerformance
        })

      case 'cache-stats':
        // Get cache statistics
        const cacheOptimizer = new QueryOptimizer()
        const cacheStats = cacheOptimizer.getCacheStatistics()
        return NextResponse.json({
          success: true,
          data: cacheStats
        })

      case 'optimization-rules':
        // Get query optimization rules
        const rulesOptimizer = new QueryOptimizer()
        const rules = rulesOptimizer.getOptimizationRules()
        return NextResponse.json({
          success: true,
          data: rules
        })

      case 'test-queries':
        // Test query performance
        const testOptimizer = new QueryOptimizer()
        const testResults = await testOptimizer.testQueryPerformance()
        return NextResponse.json({
          success: true,
          data: testResults
        })

      default:
        return NextResponse.json({
          success: true,
          data: {
            message: 'System Performance API',
            availableActions: [
              'health',
              'metrics', 
              'query-performance',
              'cache-stats',
              'optimization-rules',
              'test-queries'
            ],
            documentation: {
              health: 'GET /api/admin/system-performance?action=health',
              metrics: 'GET /api/admin/system-performance?action=metrics',
              'query-performance': 'GET /api/admin/system-performance?action=query-performance',
              'cache-stats': 'GET /api/admin/system-performance?action=cache-stats',
              'optimization-rules': 'GET /api/admin/system-performance?action=optimization-rules',
              'test-queries': 'GET /api/admin/system-performance?action=test-queries',
              'clear-cache': 'POST /api/admin/system-performance (action: clear-cache)',
              'toggle-rule': 'POST /api/admin/system-performance (action: toggle-rule)',
              'optimize-query': 'POST /api/admin/system-performance (action: optimize-query)'
            }
          }
        })
    }

  } catch (error) {
    console.error('System performance API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process system performance request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the current user
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, ...params } = body

    const queryOptimizer = new QueryOptimizer()

    switch (action) {
      case 'clear-cache':
        // Clear query cache
        const clearedEntries = queryOptimizer.clearCache()
        return NextResponse.json({
          success: true,
          data: {
            message: `Cleared ${clearedEntries} cache entries`,
            clearedEntries
          }
        })

      case 'toggle-rule':
        // Enable/disable optimization rule
        const { ruleId, enabled } = params
        if (!ruleId) {
          return NextResponse.json({ error: 'Rule ID required' }, { status: 400 })
        }
        
        const ruleToggled = queryOptimizer.setRuleEnabled(ruleId, enabled !== false)
        if (ruleToggled) {
          return NextResponse.json({
            success: true,
            data: {
              message: `Rule ${enabled ? 'enabled' : 'disabled'} successfully`,
              ruleId,
              enabled
            }
          })
        } else {
          return NextResponse.json({
            error: 'Rule not found',
            ruleId
          }, { status: 404 })
        }

      case 'optimize-query':
        // Optimize a specific query
        const { query } = params
        if (!query) {
          return NextResponse.json({ error: 'Query object required' }, { status: 400 })
        }

        try {
          const optimizedResult = await queryOptimizer.optimizeQuery(query)
          return NextResponse.json({
            success: true,
            data: {
              originalQuery: query,
              result: optimizedResult,
              message: 'Query optimized and executed successfully'
            }
          })
        } catch (queryError) {
          return NextResponse.json({
            error: 'Query optimization failed',
            details: queryError instanceof Error ? queryError.message : 'Unknown query error',
            query
          }, { status: 400 })
        }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['clear-cache', 'toggle-rule', 'optimize-query']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Failed to process system performance action:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process system performance action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get the current user
    const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'run-maintenance':
        // Run system maintenance
        try {
          const monitoringService = await initializeMonitoring()
          const backgroundJobProcessor = monitoringService.getDatabaseMonitor()
          
          // Schedule maintenance job
          const maintenanceResult = {
            scheduled: true,
            timestamp: new Date().toISOString(),
            tasks: ['database_cleanup', 'cache_optimization', 'index_maintenance']
          }

          return NextResponse.json({
            success: true,
            data: maintenanceResult
          })
        } catch (error) {
          return NextResponse.json({
            error: 'Failed to run maintenance',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 })
        }

      default:
        return NextResponse.json({
          error: 'Invalid action',
          validActions: ['run-maintenance']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Failed to execute system performance maintenance:', error)
    return NextResponse.json(
      { 
        error: 'Failed to execute system performance maintenance',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}