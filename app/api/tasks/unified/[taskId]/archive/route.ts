import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteParams {
  params: {
    taskId: string
  }
}

// Archive a task
export async function POST(request: NextRequest, { params }: RouteParams) {
  console.log('🔍 Task Archive API - POST request for task:', params.taskId)
  
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

    // Parse request body for optional reason
    const body = await request.json().catch(() => ({}))
    const { reason } = body

    // Extract note ID from task ID
    const taskParts = params.taskId.split('-')
    const noteId = taskParts.slice(0, -3).join('-')
    
    console.log('📋 Archiving task:', {
      taskId: params.taskId,
      noteId,
      reason
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
          note_id: noteId,
          archived: true,
          archived_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ Failed to create archived task state:', insertError)
        return NextResponse.json(
          { error: 'Failed to archive task' },
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
    } else {
      // Update existing state
      const { data: updatedState, error: updateError } = await supabase
        .from('task_states')
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', taskState.id)
        .select()
        .single()

      if (updateError) {
        console.error('❌ Failed to archive task:', updateError)
        return NextResponse.json(
          { error: 'Failed to archive task' },
          { status: 500 }
        )
      }

      taskState = updatedState
    }

    // Log the archive action
    await supabase
      .from('task_edit_history')
      .insert({
        user_id: user.id,
        task_id: params.taskId,
        note_id: noteId,
        field_name: 'archived',
        old_value: 'false',
        new_value: 'true',
        edit_reason: reason || 'Task archived',
        task_state_id: taskState.id
      })

    console.log('✅ Task archived successfully')

    return NextResponse.json({
      success: true,
      message: 'Task archived successfully',
      state: taskState
    })

  } catch (error) {
    console.error('❌ Task Archive API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Unarchive a task
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  console.log('🔍 Task Unarchive API - DELETE request for task:', params.taskId)
  
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

    // Parse request body for optional reason
    const body = await request.json().catch(() => ({}))
    const { reason } = body

    // Extract note ID from task ID
    const taskParts = params.taskId.split('-')
    const noteId = taskParts.slice(0, -3).join('-')
    
    console.log('📋 Unarchiving task:', {
      taskId: params.taskId,
      noteId,
      reason
    })

    // Get task state
    const { data: taskState, error: fetchError } = await supabase
      .from('task_states')
      .select('*')
      .eq('user_id', user.id)
      .eq('task_id', params.taskId)
      .single()

    if (fetchError) {
      console.error('❌ Failed to fetch task state:', fetchError)
      return NextResponse.json(
        { error: 'Task not found or not archived' },
        { status: 404 }
      )
    }

    // Update state to unarchive
    const { data: updatedState, error: updateError } = await supabase
      .from('task_states')
      .update({
        archived: false,
        archived_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskState.id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Failed to unarchive task:', updateError)
      return NextResponse.json(
        { error: 'Failed to unarchive task' },
        { status: 500 }
      )
    }

    // Log the unarchive action
    await supabase
      .from('task_edit_history')
      .insert({
        user_id: user.id,
        task_id: params.taskId,
        note_id: noteId,
        field_name: 'archived',
        old_value: 'true',
        new_value: 'false',
        edit_reason: reason || 'Task unarchived',
        task_state_id: taskState.id
      })

    console.log('✅ Task unarchived successfully')

    return NextResponse.json({
      success: true,
      message: 'Task unarchived successfully',
      state: updatedState
    })

  } catch (error) {
    console.error('❌ Task Unarchive API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}