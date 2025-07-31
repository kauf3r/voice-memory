import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Pin a task
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id
    
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

    // Validate task ID format
    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid task ID' },
        { status: 400 }
      )
    }

    // Parse task ID to extract note ID (format: "noteId-type-index")
    const taskIdParts = taskId.split('-')
    if (taskIdParts.length < 3) {
      return NextResponse.json(
        { error: 'Invalid task ID format' },
        { status: 400 }
      )
    }

    const noteId = taskIdParts.slice(0, -2).join('-') // Everything except last 2 parts
    
    // Verify the note exists and belongs to the user
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('id, user_id')
      .eq('id', noteId)
      .eq('user_id', user.id)
      .single()

    if (noteError || !note) {
      return NextResponse.json(
        { error: 'Task not found or access denied' },
        { status: 404 }
      )
    }

    // Check current pin count to provide better error messaging
    const { data: currentPins, error: countError } = await supabase
      .from('task_pins')
      .select('id')
      .eq('user_id', user.id)

    if (countError) {
      console.error('Error checking pin count:', countError)
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      )
    }

    if (currentPins && currentPins.length >= 10) {
      return NextResponse.json(
        { 
          error: 'Pin limit exceeded. You can only pin up to 10 tasks at a time.',
          code: 'PIN_LIMIT_EXCEEDED',
          currentCount: currentPins.length,
          maxPins: 10
        },
        { status: 400 }
      )
    }

    // Insert the pin
    const { data: pinData, error: pinError } = await supabase
      .from('task_pins')
      .insert({
        user_id: user.id,
        task_id: taskId
      })
      .select()
      .single()

    if (pinError) {
      // Handle duplicate pin attempt
      if (pinError.code === '23505') { // unique_violation
        return NextResponse.json(
          { error: 'Task is already pinned' },
          { status: 400 }
        )
      }
      
      console.error('Pin error:', pinError)
      return NextResponse.json(
        { error: 'Failed to pin task' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Task pinned successfully',
      pin: {
        id: pinData.id,
        taskId: taskId,
        pinnedAt: pinData.pinned_at
      }
    })

  } catch (error) {
    console.error('Unexpected error in pin endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Unpin a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id
    
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

    // Validate task ID
    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid task ID' },
        { status: 400 }
      )
    }

    // Delete the pin
    const { data: deletedPin, error: deleteError } = await supabase
      .from('task_pins')
      .delete()
      .eq('user_id', user.id)
      .eq('task_id', taskId)
      .select()
      .single()

    if (deleteError) {
      console.error('Unpin error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to unpin task' },
        { status: 500 }
      )
    }

    if (!deletedPin) {
      return NextResponse.json(
        { error: 'Task was not pinned' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Task unpinned successfully',
      taskId: taskId
    })

  } catch (error) {
    console.error('Unexpected error in unpin endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}