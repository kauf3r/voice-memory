import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { TaskStateService } from '@/lib/services/TaskStateService'

// Reorder pinned tasks
export async function POST(request: NextRequest) {
  try {
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

    // Use TaskStateService to reorder the task
    const taskStateService = new TaskStateService(dbClient)
    
    try {
      // Verify the task is pinned by this user first
      const isPinned = await taskStateService.isTaskPinned(user.id, taskId)
      
      if (!isPinned) {
        return NextResponse.json(
          { error: 'Task is not pinned or access denied' },
          { status: 404 }
        )
      }

      // Reorder the pinned task
      await taskStateService.reorderPinnedTasks(user.id, taskId, newOrder)

      // Get updated pinned tasks for verification
      const updatedTaskStates = await taskStateService.getPinnedTasks(user.id)
      const updatedPins = updatedTaskStates.map(ts => ({
        task_id: ts.task_id,
        pin_order: ts.pin_order
      }))

      return NextResponse.json({
        success: true,
        message: 'Pins reordered successfully',
        taskId,
        newOrder,
        updatedPins
      })
    } catch (serviceError) {
      console.error('TaskStateService error:', serviceError)
      return NextResponse.json(
        { error: 'Failed to reorder pins' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Unexpected error in reorder pins endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}