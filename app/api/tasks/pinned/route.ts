import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

// Get all pinned tasks for the authenticated user
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    
    // Use centralized authentication helper
    const { user, error: authError, client: dbClient } = await getAuthenticatedUser(token)
    
    if (authError || !user || !dbClient) {
      return NextResponse.json(
        { error: authError?.message || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    // Get all pinned task IDs for the user ordered by pin_order
    const { data: pins, error: pinsError } = await dbClient
      .from('task_pins')
      .select('task_id, pinned_at, pin_order')
      .eq('user_id', user.id)
      .order('pin_order', { ascending: true })
      .order('pinned_at', { ascending: true })

    if (pinsError) {
      return NextResponse.json(
        { error: 'Database error' },
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}