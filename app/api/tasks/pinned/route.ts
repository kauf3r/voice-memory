import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

// Get all pinned tasks for the authenticated user
export async function GET(request: NextRequest) {
  console.log('🔍 Pinned tasks API - GET request started')
  console.log('📊 Environment check:', {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    timestamp: new Date().toISOString()
  })
  
  try {
    // Create service client for authentication
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    console.log('📋 Auth header analysis:', {
      present: !!authHeader,
      startsWithBearer: authHeader?.startsWith('Bearer '),
      length: authHeader?.length || 0
    })
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    console.log('🎟️ Token analysis:', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 20) + '...',
      tokenEnd: '...' + token.substring(token.length - 20)
    })
    
    // Verify the user
    console.log('🔐 Attempting to validate token with service client...')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('❌ Authentication failed:', {
        error: authError,
        hasUser: !!user
      })
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }
    
    console.log('✅ User authenticated:', {
      userId: user.id,
      userEmail: user.email
    })

    // Get all pinned task IDs for the user ordered by pin_order
    const { data: pins, error: pinsError } = await supabase
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