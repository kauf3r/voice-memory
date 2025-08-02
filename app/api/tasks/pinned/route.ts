import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

// Get all pinned tasks for the authenticated user
export async function GET(request: NextRequest) {
  console.log('🔍 Pinned tasks API - GET request started')
  
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    
    // Use centralized authentication helper
    let authResult
    try {
      authResult = await getAuthenticatedUser(token)
    } catch (helperError) {
      console.error('🚨 Auth helper threw exception:', helperError)
      return NextResponse.json(
        { error: 'Authentication system error' },
        { status: 500 }
      )
    }
    
    const { user, error: authError, client: dbClient } = authResult
    
    if (authError || !user || !dbClient) {
      console.error('❌ Authentication failed:', {
        error: authError,
        hasUser: !!user,
        hasClient: !!dbClient,
        authErrorMessage: authError?.message,
        tokenPreview: token.substring(0, 20) + '...'
      })
      return NextResponse.json(
        { 
          error: 'Invalid authentication token',
          details: authError?.message || 'Authentication failed',
          debug: {
            hasUser: !!user,
            hasClient: !!dbClient,
            tokenLength: token.length
          }
        },
        { status: 401 }
      )
    }
    
    console.log('✅ User authenticated:', {
      userId: user.id,
      userEmail: user.email
    })
    
    // Get all pinned task IDs for the user ordered by pin_order
    const { data: pins, error: pinsError } = await dbClient
      .from('task_pins')
      .select('task_id, pinned_at, pin_order')
      .eq('user_id', user.id)
      .order('pin_order', { ascending: true }) // Order by pin order first
      .order('pinned_at', { ascending: true }) // Fallback to pin time

    if (pinsError) {
      console.error('Error fetching pinned tasks:', pinsError)
      return NextResponse.json(
        { error: 'Failed to fetch pinned tasks' },
        { status: 500 }
      )
    }

    // Extract just the task IDs and pin metadata
    const pinnedTasks = pins?.map(pin => ({
      taskId: pin.task_id,
      pinnedAt: pin.pinned_at,
      pinOrder: pin.pin_order
    })) || []

    return NextResponse.json({
      success: true,
      pinnedTasks,
      count: pinnedTasks.length,
      maxPins: 10
    })

  } catch (error) {
    console.error('Unexpected error in pinned tasks endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}