import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization header missing or invalid' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    
    // Verify the user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Get pinned tasks for this user
    const { data: pinnedTasks, error: pinnedError } = await supabase
      .from('task_pins')
      .select('task_id, pin_order, created_at')
      .eq('user_id', user.id)
      .order('pin_order', { ascending: true })

    if (pinnedError) {
      console.error('Error fetching pinned tasks:', pinnedError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch pinned tasks' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      pinnedTasks: pinnedTasks.map(pin => ({
        taskId: pin.task_id,
        pinOrder: pin.pin_order,
        createdAt: pin.created_at
      }))
    })

  } catch (error) {
    console.error('Error in GET /api/tasks/pinned:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}