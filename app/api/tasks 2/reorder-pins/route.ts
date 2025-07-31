import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
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

    // Parse request body
    const { taskId, newOrder } = await request.json()
    
    if (!taskId || typeof newOrder !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid taskId or newOrder' },
        { status: 400 }
      )
    }

    // Get all pinned tasks for this user
    const { data: pinnedTasks, error: fetchError } = await supabase
      .from('task_pins')
      .select('id, task_id, pin_order')
      .eq('user_id', user.id)
      .order('pin_order', { ascending: true })

    if (fetchError) {
      console.error('Error fetching pinned tasks:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch pinned tasks' },
        { status: 500 }
      )
    }

    // Find the task to reorder
    const taskToReorder = pinnedTasks.find(task => task.task_id === taskId)
    if (!taskToReorder) {
      return NextResponse.json(
        { success: false, error: 'Task is not pinned' },
        { status: 400 }
      )
    }

    // Validate new order
    if (newOrder < 0 || newOrder >= pinnedTasks.length) {
      return NextResponse.json(
        { success: false, error: 'Invalid new order position' },
        { status: 400 }
      )
    }

    // Reorder the tasks
    const reorderedTasks = [...pinnedTasks]
    const currentIndex = reorderedTasks.findIndex(task => task.task_id === taskId)
    const [movedTask] = reorderedTasks.splice(currentIndex, 1)
    reorderedTasks.splice(newOrder, 0, movedTask)

    // Update pin orders in database
    const updates = reorderedTasks.map((task, index) => ({
      id: task.id,
      pin_order: index + 1
    }))

    // Use a transaction to update all pin orders atomically
    const { error: updateError } = await supabase.rpc('update_pin_orders', {
      updates_json: JSON.stringify(updates)
    })

    if (updateError) {
      // Fallback to individual updates if the RPC doesn't exist
      console.warn('RPC update_pin_orders not found, using individual updates')
      
      for (const update of updates) {
        const { error } = await supabase
          .from('task_pins')
          .update({ pin_order: update.pin_order })
          .eq('id', update.id)
          .eq('user_id', user.id) // Additional safety check
        
        if (error) {
          console.error('Error updating pin order:', error)
          return NextResponse.json(
            { success: false, error: 'Failed to update pin orders' },
            { status: 500 }
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Pins reordered successfully',
      newOrder: updates.map(u => ({ id: u.id, order: u.pin_order }))
    })

  } catch (error) {
    console.error('Error in POST /api/tasks/reorder-pins:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}