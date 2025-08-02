import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteParams {
  params: {
    taskId: string
  }
}

// Get task state
export async function GET(request: NextRequest, { params }: RouteParams) {
  console.log('🔍 Unified Task State API - GET request for task:', params.taskId)
  
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )
    
    const { data, error: authError } = await supabase.auth.getUser()
    
    if (authError || !data?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const user = data.user

    // Get task state
    const { data: taskState, error: fetchError } = await supabase
      .from('task_states')
      .select('*')
      .eq('user_id', user.id)
      .eq('task_id', params.taskId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // Not found is ok
      console.error('❌ Failed to fetch task state:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch task state' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      taskId: params.taskId,
      state: taskState || {
        completed: false,
        pinned: false,
        archived: false,
        pinOrder: null,
        completedAt: null,
        completedBy: null,
        completionNotes: null,
        pinnedAt: null,
        archivedAt: null,
        metadata: {}
      }
    })

  } catch (error) {
    console.error('❌ Unified Task State API GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update task state
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  console.log('🔍 Unified Task State API - PATCH request for task:', params.taskId)
  
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )
    
    const { data, error: authError } = await supabase.auth.getUser()
    
    if (authError || !data?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const user = data.user

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { 
      completed, 
      pinned, 
      archived, 
      pinOrder, 
      completedBy, 
      completionNotes,
      editReason,
      metadata 
    } = body

    // Extract note ID from task ID
    const taskParts = params.taskId.split('-')
    const noteId = taskParts.slice(0, -3).join('-') // Everything except last 3 parts (task-index-hash)
    
    console.log('📋 Updating task state:', {
      taskId: params.taskId,
      noteId,
      updates: body
    })

    // Get or create task state
    let { data: taskState, error: fetchError } = await supabase
      .from('task_states')
      .select('*')
      .eq('user_id', user.id)
      .eq('task_id', params.taskId)
      .single()

    if (fetchError && fetchError.code === 'PGRST116') {
      // Create new task state
      const { data: newState, error: insertError } = await supabase
        .from('task_states')
        .insert({
          user_id: user.id,
          task_id: params.taskId,
          note_id: noteId
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ Failed to create task state:', insertError)
        return NextResponse.json(
          { error: 'Failed to create task state' },
          { status: 500 }
        )
      }
      
      taskState = newState
    } else if (fetchError) {
      console.error('❌ Failed to fetch task state:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch task state' },
        { status: 500 }
      )
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString()
    }

    // Handle completion state
    if (typeof completed === 'boolean') {
      updates.completed = completed
      updates.completed_at = completed ? new Date().toISOString() : null
      if (completed && completedBy) {
        updates.completed_by = completedBy
      }
      if (completed && completionNotes) {
        updates.completion_notes = completionNotes
      }
    }

    // Handle pin state
    if (typeof pinned === 'boolean') {
      updates.pinned = pinned
      updates.pinned_at = pinned ? new Date().toISOString() : null
      if (pinned && typeof pinOrder === 'number') {
        updates.pin_order = pinOrder
      } else if (!pinned) {
        updates.pin_order = null
      }
    }

    // Handle archive state
    if (typeof archived === 'boolean') {
      updates.archived = archived
      updates.archived_at = archived ? new Date().toISOString() : null
    }

    // Handle metadata updates
    if (metadata && typeof metadata === 'object') {
      updates.metadata = { ...(taskState?.metadata || {}), ...metadata }
    }

    // Update task state
    const { data: updatedState, error: updateError } = await supabase
      .from('task_states')
      .update(updates)
      .eq('id', taskState.id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Failed to update task state:', updateError)
      return NextResponse.json(
        { error: 'Failed to update task state' },
        { status: 500 }
      )
    }

    // Log edit history for significant changes
    const significantFields = ['completed', 'pinned', 'archived', 'completion_notes']
    for (const field of significantFields) {
      if (updates[field] !== undefined && updates[field] !== taskState[field]) {
        await supabase
          .from('task_edit_history')
          .insert({
            user_id: user.id,
            task_id: params.taskId,
            note_id: noteId,
            field_name: field,
            old_value: taskState[field]?.toString() || null,
            new_value: updates[field]?.toString() || null,
            edit_reason: editReason || null,
            task_state_id: taskState.id
          })
      }
    }

    console.log('✅ Task state updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Task state updated successfully',
      state: updatedState
    })

  } catch (error) {
    console.error('❌ Unified Task State API PATCH error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}