import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { processingService } from '@/lib/processing/ProcessingService'
import { isAdminUser } from '@/lib/auth-utils'

// In-memory cache for stats
interface CachedStats {
  data: any
  timestamp: number
  userId: string
}

const statsCache = new Map<string, CachedStats>()
const globalStatsCache = new Map<string, CachedStats>()
const CACHE_TTL = 30 * 1000 // 30 seconds
const GLOBAL_CACHE_TTL = 10 * 1000 // 10 seconds for global metrics


// Helper function to get cached stats or fetch new ones
async function getCachedStats(userId: string) {
  const cacheKey = `stats_${userId}`
  const cached = statsCache.get(cacheKey)
  const now = Date.now()

  // Return cached data if it's still valid
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data
  }

  // Fetch fresh stats
  const stats = await processingService.getProcessingStats(userId)
  
  // Calculate error rate
  const errorRate = stats.failed > 0 ? (stats.failed / stats.total) * 100 : 0
  
  const statsWithErrorRate = {
    ...stats,
    error_rate: errorRate,
    cached: false,
    timestamp: new Date().toISOString()
  }

  // Cache the results
  statsCache.set(cacheKey, {
    data: statsWithErrorRate,
    timestamp: now,
    userId
  })

  // Clean up old cache entries (basic memory management)
  if (statsCache.size > 100) {
    const entries = Array.from(statsCache.entries())
    const oldEntries = entries.filter(([_, entry]) => (now - entry.timestamp) > CACHE_TTL * 2)
    oldEntries.forEach(([key]) => statsCache.delete(key))
  }

  return statsWithErrorRate
}

// Helper function to get global metrics for admin users
async function getCachedGlobalStats() {
  const cacheKey = 'global_stats'
  const cached = globalStatsCache.get(cacheKey)
  const now = Date.now()

  // Return cached data if it's still valid
  if (cached && (now - cached.timestamp) < GLOBAL_CACHE_TTL) {
    return cached.data
  }

  try {
    // Fetch fresh global metrics
    const summaryMetrics = await processingService.getSummaryMetrics()
    const circuitBreakerStatus = await processingService.getCircuitBreakerStatus()
    
    // Convert Map objects to plain objects for JSON serialization
    const globalStats = {
      success_rate: summaryMetrics.successRate,
      circuit_breaker_status: {
        isOpen: circuitBreakerStatus.isOpen,
        failures: circuitBreakerStatus.failures,
        errorTypes: (circuitBreakerStatus.errorTypes instanceof Map) 
          ? Object.fromEntries(circuitBreakerStatus.errorTypes)
          : circuitBreakerStatus.errorTypes || {},
        lastFailureTime: circuitBreakerStatus.lastFailureTime
      },
      error_breakdown: (summaryMetrics.errorCategoryBreakdown instanceof Map) 
        ? Object.fromEntries(summaryMetrics.errorCategoryBreakdown)
        : summaryMetrics.errorCategoryBreakdown || {},
      average_processing_time: summaryMetrics.averageProcessingTime,
      currently_processing: summaryMetrics.currentlyProcessing,
      uptime: summaryMetrics.uptime,
      total_processed: summaryMetrics.totalProcessed,
      total_successful: summaryMetrics.totalSuccessful,
      total_failed: summaryMetrics.totalFailed,
      last_reset_time: summaryMetrics.lastResetTime,
      cached: false,
      timestamp: new Date().toISOString()
    }

    // Cache the results
    globalStatsCache.set(cacheKey, {
      data: globalStats,
      timestamp: now,
      userId: 'global'
    })

    // Clean up old cache entries
    if (globalStatsCache.size > 10) {
      const entries = Array.from(globalStatsCache.entries())
      const oldEntries = entries.filter(([_, entry]) => (now - entry.timestamp) > GLOBAL_CACHE_TTL * 2)
      oldEntries.forEach(([key]) => globalStatsCache.delete(key))
    }

    return globalStats
  } catch (error) {
    console.error('Failed to fetch global stats:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const url = new URL(request.url)
    const scope = url.searchParams.get('scope') || 'user'
    
    // Try to get user from Authorization header first
    let user = null
    let authError = null
    
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data, error } = await supabase.auth.getUser(token)
      
      if (error) {
        authError = error
      } else {
        user = data?.user
        // Set the session for this request
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: token
        })
      }
    }
    
    // If no auth header or it failed, try to get from cookies
    if (!user) {
      const { data: { user: cookieUser }, error } = await supabase.auth.getUser()
      user = cookieUser
      authError = error
    }
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user-specific stats
    const stats = await getCachedStats(user.id)
    
    // Prepare response data
    let responseData: any = {
      success: true,
      ...stats
    }

    // Add global metrics for admin users or when explicitly requested
    if ((scope === 'global' || scope === 'both') && isAdminUser(user)) {
      const globalStats = await getCachedGlobalStats()
      if (globalStats) {
        responseData.global_metrics = globalStats
      }
    } else if (scope === 'global' && !isAdminUser(user)) {
      return NextResponse.json(
        { error: 'Insufficient permissions for global metrics' },
        { status: 403 }
      )
    }

    // Set cache headers for client-side caching
    const response = NextResponse.json(responseData)

    // Adjust cache headers based on scope
    if (scope === 'global' || responseData.global_metrics) {
      response.headers.set('Cache-Control', 'private, max-age=10, stale-while-revalidate=30')
    } else {
      response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    }
    
    response.headers.set('ETag', `"${user.id}-${scope}-${Math.floor(Date.now() / (scope === 'global' ? GLOBAL_CACHE_TTL : CACHE_TTL))}"`)
    
    return response

  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to get processing stats' },
      { status: 500 }
    )
  }
}

// Optional: Allow cache invalidation via DELETE request
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data, error } = await supabase.auth.getUser(token)
      
      if (error || !data?.user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      // Clear cache for this user and global cache if admin
      const cacheKey = `stats_${data.user.id}`
      statsCache.delete(cacheKey)
      
      if (isAdminUser(data.user)) {
        globalStatsCache.delete('global_stats')
      }

      return NextResponse.json({
        success: true,
        message: 'Cache cleared'
      })
    }

    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )

  } catch (error) {
    console.error('Cache clear API error:', error)
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    )
  }
} 