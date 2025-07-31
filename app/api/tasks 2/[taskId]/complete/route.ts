import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic behavior to handle cookies and searchParams
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteParams {
  params: {
    taskId: string
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  console.log('🔍 Task Complete API - POST request started for task:', params.taskId)
  
  try {
    // Get user from Authorization header (matching knowledge API pattern)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    console.log('📋 Task Complete API - Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Task Complete API - Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    console.log('🎟️ Task Complete API - Token received (first 20 chars):', token.substring(0, 20) + '...')
    
    // Create client with the provided token
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
    
    console.log('🔐 Task Complete API - Attempting to validate token with Supabase...')
    const { data, error: authError } = await supabase.auth.getUser()
    
    if (authError || !data?.user) {
      console.error('❌ Task Complete API - Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const user = data.user
    console.log('✅ Task Complete API - User authenticated:', user.id)

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { completedBy, notes } = body

    // Extract note ID from task ID for foreign key constraint
    // Task ID format: {noteId}-{type}-{index} where noteId is a full UUID
    const taskParts = params.taskId.split('-')
    const noteId = taskParts.slice(0, -2).join('-') // Everything except last 2 parts (type and index)
    
    console.log('📋 Marking task as complete:', {
      taskId: params.taskId,
      noteId,
      completedBy,
      hasNotes: !!notes
    })

    // Insert completion record
    const { data: completion, error: insertError } = await supabase
      .from('task_completions')
      .insert({
        user_id: user.id,
        task_id: params.taskId,
        note_id: noteId,
        completed_by: completedBy || null,
        notes: notes || null
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to mark task as complete:', insertError)
      
      // Handle duplicate completion attempt
      if (insertError.code === '23505') { // unique_violation
        return NextResponse.json(
          { error: 'Task is already marked as complete' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to complete task', details: insertError.message },
        { status: 500 }
      )
    }

    console.log('✅ Task marked as complete successfully')

    return NextResponse.json({
      success: true,
      message: 'Task marked as complete',
      completion: {
        id: completion.id,
        taskId: completion.task_id,
        completedAt: completion.completed_at,
        completedBy: completion.completed_by,
        notes: completion.notes
      }
    })

  } catch (error) {
    console.error('❌ Task Complete API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  console.log('🔍 Task Uncomplete API - DELETE request started for task:', params.taskId)
  
  try {
    // Get user from Authorization header (matching knowledge API pattern)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    console.log('📋 Task Uncomplete API - Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Task Uncomplete API - Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    console.log('🎟️ Task Uncomplete API - Token received (first 20 chars):', token.substring(0, 20) + '...')
    
    // Create client with the provided token
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
    
    console.log('🔐 Task Uncomplete API - Attempting to validate token with Supabase...')
    const { data, error: authError } = await supabase.auth.getUser()
    
    if (authError || !data?.user) {
      console.error('❌ Task Uncomplete API - Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const user = data.user
    console.log('✅ Task Uncomplete API - User authenticated:', user.id)

    console.log('📋 Removing task completion:', params.taskId)

    // Delete completion record
    const { error: deleteError } = await supabase
      .from('task_completions')
      .delete()
      .eq('user_id', user.id)
      .eq('task_id', params.taskId)

    if (deleteError) {
      console.error('❌ Failed to uncomplete task:', deleteError)
      return NextResponse.json(
        { error: 'Failed to uncomplete task', details: deleteError.message },
        { status: 500 }
      )
    }

    console.log('✅ Task completion removed successfully')

    return NextResponse.json({
      success: true,
      message: 'Task marked as incomplete'
    })

  } catch (error) {
    console.error('❌ Task Uncomplete API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check completion status
export async function GET(request: NextRequest, { params }: RouteParams) {
  console.log('🔍 Task Status API - GET request started for task:', params.taskId)
  
  try {
    // Get user from Authorization header (matching knowledge API pattern)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    
    // Create client with the provided token
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

    // Get completion status
    const { data: completion, error: fetchError } = await supabase
      .from('task_completions')
      .select('completed_at, completed_by, notes')
      .eq('user_id', user.id)
      .eq('task_id', params.taskId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // Not found is ok
      console.error('❌ Failed to fetch task status:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch task status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      taskId: params.taskId,
      completed: !!completion,
      completedAt: completion?.completed_at,
      completedBy: completion?.completed_by,
      notes: completion?.notes
    })

  } catch (error) {
    console.error('❌ Task Status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}