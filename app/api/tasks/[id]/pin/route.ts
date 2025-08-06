import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    
    // Create service client for authentication - fallback to anon key if service key not available
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Verify the user - handle both service key and anon key scenarios
    let user = null
    let authError = null
    
    if (process.env.SUPABASE_SERVICE_KEY) {
      // If we have a service key, use it to validate the token
      const { data: { user: serviceUser }, error: serviceError } = await supabase.auth.getUser(token)
      user = serviceUser
      authError = serviceError
    } else {
      // If using anon key, create a new client with the user's token
      const authenticatedClient = createClient(
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
      
      const { data: { user: anonUser }, error: anonError } = await authenticatedClient.auth.getUser()
      user = anonUser
      authError = anonError
    }
    
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
    
    // Use the authenticated client for database queries when using anon key
    const dbClient = process.env.SUPABASE_SERVICE_KEY ? supabase : createClient(
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

    // Check current pin count to provide better error messaging
    const { data: currentPins, error: countError } = await dbClient
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
    const { data: pinData, error: pinError } = await dbClient
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
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    
    // Create service client for authentication - fallback to anon key if service key not available
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Verify the user - handle both service key and anon key scenarios
    let user = null
    let authError = null
    
    if (process.env.SUPABASE_SERVICE_KEY) {
      // If we have a service key, use it to validate the token
      const { data: { user: serviceUser }, error: serviceError } = await supabase.auth.getUser(token)
      user = serviceUser
      authError = serviceError
    } else {
      // If using anon key, create a new client with the user's token
      const authenticatedClient = createClient(
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
      
      const { data: { user: anonUser }, error: anonError } = await authenticatedClient.auth.getUser()
      user = anonUser
      authError = anonError
    }
    
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
    
    // Use the authenticated client for database queries when using anon key
    const dbClient = process.env.SUPABASE_SERVICE_KEY ? supabase : createClient(
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

    // Delete the pin
    const { data: deletedPin, error: deleteError } = await dbClient
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