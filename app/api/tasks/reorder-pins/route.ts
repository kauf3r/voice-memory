import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Reorder pinned tasks
export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    
    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { taskId, newOrder } = body

    // Validate input
    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or missing taskId' },
        { status: 400 }
      )
    }

    if (typeof newOrder !== 'number' || newOrder < 0) {
      return NextResponse.json(
        { error: 'Invalid or missing newOrder (must be non-negative integer)' },
        { status: 400 }
      )
    }

    // Verify the task is pinned by this user
    const { data: existingPin, error: pinError } = await supabase
      .from('task_pins')
      .select('id, pin_order')
      .eq('user_id', user.id)
      .eq('task_id', taskId)
      .single()

    if (pinError || !existingPin) {
      return NextResponse.json(
        { error: 'Task is not pinned or access denied' },
        { status: 404 }
      )
    }

    // Call the reorder function
    const { error: reorderError } = await supabase
      .rpc('reorder_pins', {
        p_user_id: user.id,
        p_task_id: taskId,
        p_new_order: newOrder
      })

    if (reorderError) {
      console.error('Reorder error:', reorderError)
      return NextResponse.json(
        { error: 'Failed to reorder pins' },
        { status: 500 }
      )
    }

    // Get updated pin orders for verification
    const { data: updatedPins, error: fetchError } = await supabase
      .from('task_pins')
      .select('task_id, pin_order')
      .eq('user_id', user.id)
      .order('pin_order', { ascending: true })

    if (fetchError) {
      console.error('Fetch updated pins error:', fetchError)
      // Don't fail the request - reorder likely succeeded
    }

    return NextResponse.json({
      success: true,
      message: 'Pins reordered successfully',
      taskId,
      newOrder,
      updatedPins: updatedPins || []
    })

  } catch (error) {
    console.error('Unexpected error in reorder pins endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}