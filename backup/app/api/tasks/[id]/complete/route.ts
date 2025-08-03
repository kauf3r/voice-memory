import { NextRequest, NextResponse } from 'next/server'
import { getUserScopedClient } from '@/lib/supabase-server'
import { validateTaskId, validateRequest, sanitizeErrorMessage } from '@/lib/utils/validation'
import { createClient } from '@supabase/supabase-js'
import { createDatabaseService } from '@/lib/database/queries'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

// Mark task as complete (POST)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: taskId } = await params
  console.log('🔍 Task Complete API - POST request for task:', taskId)

  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Validate task ID
    const taskIdValidation = validateTaskId(taskId)
    if (!taskIdValidation.isValid) {
      return NextResponse.json(
        { error: taskIdValidation.error },
        { status: 400 }
      )
    }

    // Create user-scoped client
    const userClient = createClient(
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
    
    // Get user from token
    const { data, error: authError } = await userClient.auth.getUser()
    
    if (authError || !data?.user) {
      console.error('❌ Authentication failed:', authError?.message)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }
    
    const user = data.user

    console.log('✅ User authenticated, marking task as complete:', taskId)

    // Create database service instance with authenticated client
    const dbService = createDatabaseService(userClient)
    
    // Update task state using abstracted database layer
    const taskStateResult = await dbService.updateTaskState(user.id, taskId, true)

    if (!taskStateResult.success) {
      console.error('❌ Failed to mark task complete:', taskStateResult.error)
      throw new Error(taskStateResult.error || 'Failed to update task state')
    }

    console.log('✅ Task marked as complete:', taskStateResult.data)
    
    return NextResponse.json({
      success: true,
      message: 'Task marked as complete',
      taskState: taskStateResult.data
    })

  } catch (error) {
    console.error('❌ Error in POST /api/tasks/[id]/complete:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      taskId,
      timestamp: new Date().toISOString()
    })
    return NextResponse.json(
      { 
        error: sanitizeErrorMessage(error),
        success: false
      },
      { status: 500 }
    )
  }
}

// Mark task as incomplete (DELETE)  
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: taskId } = await params
  console.log('🔍 Task Complete API - DELETE request for task:', taskId)

  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Create user-scoped client
    const userClient = createClient(
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
    
    // Get user from token
    const { data, error: authError } = await userClient.auth.getUser()
    
    if (authError || !data?.user) {
      console.error('❌ Authentication failed:', authError?.message)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }
    
    const user = data.user

    console.log('✅ User authenticated, marking task as incomplete:', taskId)

    // Create database service instance with authenticated client
    const dbService = createDatabaseService(userClient)
    
    // Update task state using abstracted database layer
    const taskStateResult = await dbService.updateTaskState(user.id, taskId, false)

    if (!taskStateResult.success) {
      console.error('❌ Failed to mark task incomplete:', taskStateResult.error)
      throw new Error(taskStateResult.error || 'Failed to update task state')
    }

    console.log('✅ Task marked as incomplete:', taskStateResult.data)
    
    return NextResponse.json({
      success: true,
      message: 'Task marked as incomplete',
      taskState: taskStateResult.data
    })

  } catch (error) {
    console.error('❌ Error in DELETE /api/tasks/[id]/complete:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to mark task incomplete',
        success: false 
      },
      { status: 500 }
    )
  }
}