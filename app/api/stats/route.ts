import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { processingService } from '@/lib/processing-service'

// In-memory cache for stats
interface CachedStats {
  data: any
  timestamp: number
  userId: string
}

const statsCache = new Map<string, CachedStats>()
const CACHE_TTL = 30 * 1000 // 30 seconds

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

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
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

    // Get cached or fresh stats
    const stats = await getCachedStats(user.id)

    // Set cache headers for client-side caching
    const response = NextResponse.json({
      success: true,
      ...stats
    })

    // Add cache headers
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
    response.headers.set('ETag', `"${user.id}-${Math.floor(Date.now() / (CACHE_TTL))}"`)
    
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

      // Clear cache for this user
      const cacheKey = `stats_${data.user.id}`
      statsCache.delete(cacheKey)

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