import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

// Get all pinned tasks for the authenticated user
export async function GET(request: NextRequest) {
  console.log('🔍 /api/tasks/pinned - GET request started')
  
  try {
    // Log request details for debugging
    console.log('📊 Request details:', {
      method: request.method,
      url: request.url,
      headers: {
        authorization: request.headers.get('authorization') ? 'Bearer [REDACTED]' : 'Missing',
        userAgent: request.headers.get('user-agent'),
        origin: request.headers.get('origin')
      }
    })
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    console.log('🔑 Token extracted, length:', token?.length || 0)
    
    // Use centralized authentication helper with SERVICE_KEY
    console.log('🔐 Calling getAuthenticatedUser...')
    const { user, error: authError, client: dbClient } = await getAuthenticatedUser(token)
    
    if (authError || !user || !dbClient) {
      console.error('❌ Authentication failed:', {
        hasUser: !!user,
        hasClient: !!dbClient,
        errorMessage: authError?.message,
        errorDetails: authError
      })
      return NextResponse.json(
        { error: authError?.message || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    console.log('✅ User authenticated successfully:', {
      userId: user.id,
      userEmail: user.email
    })
    
    // Get all pinned task IDs for the user ordered by pin_order
    console.log('🗄️ Querying task_pins table for user:', user.id)
    const { data: pins, error: pinsError } = await dbClient
      .from('task_pins')
      .select('task_id, pinned_at, pin_order')
      .eq('user_id', user.id)
      .order('pin_order', { ascending: true })
      .order('pinned_at', { ascending: true })

    if (pinsError) {
      console.error('🚨 Database query failed:', {
        error: pinsError,
        message: pinsError.message,
        details: pinsError.details,
        hint: pinsError.hint,
        code: pinsError.code
      })
      return NextResponse.json(
        { 
          error: 'Database query failed',
          details: pinsError.message,
          code: pinsError.code 
        },
        { status: 500 }
      )
    }

    console.log('📈 Database query successful:', {
      rowCount: pins?.length || 0,
      pins: pins?.map(p => ({ taskId: p.task_id, order: p.pin_order }))
    })

    // Extract just the task IDs and pin metadata
    const pinnedTasks = pins?.map(pin => ({
      taskId: pin.task_id,
      pinnedAt: pin.pinned_at,
      pinOrder: pin.pin_order
    })) || []

    console.log('✅ Returning successful response with', pinnedTasks.length, 'pinned tasks')

    return NextResponse.json({
      success: true,
      pinnedTasks,
      count: pinnedTasks.length,
      maxPins: 10
    })

  } catch (error) {
    console.error('❌ Unexpected error in /api/tasks/pinned:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}