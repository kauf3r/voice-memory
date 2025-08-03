import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { TaskStateService } from '@/lib/services/TaskStateService'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

// Get all pinned tasks for the authenticated user
export async function GET(request: NextRequest) {
  console.log('🔍 /api/tasks/pinned - GET request started')
  
  try {
    // Log request details for debugging
    console.log('📊 Request details:', {
      method: request.method,
      url: request.url,
      headers: {
        authorization: request.headers.get('authorization') ? 'Bearer [REDACTED]' : 'Missing',
        userAgent: request.headers.get('user-agent'),
        origin: request.headers.get('origin')
      }
    })
    
    // Get the authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    console.log('🔑 Token extracted, length:', token?.length || 0)
    
    // Use centralized authentication helper with SERVICE_KEY
    console.log('🔐 Calling getAuthenticatedUser...')
    const { user, error: authError, client: dbClient } = await getAuthenticatedUser(token)
    
    if (authError || !user || !dbClient) {
      console.error('❌ Authentication failed:', {
        hasUser: !!user,
        hasClient: !!dbClient,
        errorMessage: authError?.message,
        errorDetails: authError
      })
      return NextResponse.json(
        { error: authError?.message || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    console.log('✅ User authenticated successfully:', {
      userId: user.id,
      userEmail: user.email
    })
    
    // Use TaskStateService to get pinned tasks
    console.log('🗄️ Getting pinned tasks for user:', user.id)
    const taskStateService = new TaskStateService(dbClient)
    
    try {
      const taskStates = await taskStateService.getPinnedTasks(user.id)
      
      console.log('📈 TaskStateService query successful:', {
        rowCount: taskStates.length,
        taskStates: taskStates.map(ts => ({ taskId: ts.task_id, order: ts.pin_order }))
      })

      // Extract just the task IDs and pin metadata
      const pinnedTasks = taskStates.map(taskState => ({
        taskId: taskState.task_id,
        pinnedAt: taskState.pinned_at,
        pinOrder: taskState.pin_order
      }))
      
      console.log('✅ Returning successful response with', pinnedTasks.length, 'pinned tasks')

      return NextResponse.json({
        success: true,
        pinnedTasks,
        count: pinnedTasks.length,
        maxPins: 10
      })
    } catch (serviceError) {
      console.error('🚨 TaskStateService query failed:', serviceError)
      return NextResponse.json(
        { 
          error: 'Database query failed',
          details: serviceError instanceof Error ? serviceError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }


  } catch (error) {
    console.error('❌ Unexpected error in /api/tasks/pinned:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}