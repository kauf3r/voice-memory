import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { TaskStateService } from '@/lib/services/TaskStateService'

// Pin a task
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    
    // Use centralized authentication
    const { user, error: authError, client: dbClient } = await getAuthenticatedUser(token)
    
    if (authError || !user || !dbClient) {
      return NextResponse.json(
        { error: authError?.message || 'Authentication failed' },
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
    const { data: note, error: noteError } = await dbClient
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

    // Use TaskStateService to pin the task
    const taskStateService = new TaskStateService(dbClient)
    
    try {
      const taskState = await taskStateService.pinTask({
        user_id: user.id,
        task_id: taskId,
        note_id: noteId
      })

      return NextResponse.json({
        success: true,
        message: 'Task pinned successfully',
        pin: {
          id: taskState.id,
          taskId: taskId,
          pinnedAt: taskState.pinned_at
        }
      })
    } catch (serviceError) {
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Unknown error'
      
      // Map service errors to appropriate HTTP status codes
      if (errorMessage.includes('Pin limit exceeded')) {
        return NextResponse.json(
          { 
            error: errorMessage,
            code: 'PIN_LIMIT_EXCEEDED',
            maxPins: 10
          },
          { status: 400 }
        )
      }
      
      if (errorMessage.includes('already pinned')) {
        return NextResponse.json(
          { error: errorMessage },
          { status: 400 }
        )
      }
      
      console.error('TaskStateService error:', serviceError)
      return NextResponse.json(
        { error: 'Failed to pin task' },
        { status: 500 }
      )
    }

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
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    
    // Use centralized authentication
    const { user, error: authError, client: dbClient } = await getAuthenticatedUser(token)
    
    if (authError || !user || !dbClient) {
      return NextResponse.json(
        { error: authError?.message || 'Authentication failed' },
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
    
    // Use TaskStateService to unpin the task
    const taskStateService = new TaskStateService(dbClient)
    
    try {
      const success = await taskStateService.unpinTask(user.id, taskId)

      if (!success) {
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
    } catch (serviceError) {
      console.error('TaskStateService error:', serviceError)
      return NextResponse.json(
        { error: 'Failed to unpin task' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Unexpected error in unpin endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}