import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    
    // Verify the task is pinned by this user
    const { data: existingPin, error: pinError } = await dbClient
      .from('task_pins')
      .select('id, pin_order')
      .eq('user_id', user.id)
      .eq('task_id', taskId)
      .single()

    if (pinError || !existingPin) {
      return NextResponse.json(
        { error: 'Task is not pinned or access denied' },
        { status: 404 }
      )
    }

    // Call the reorder function
    const { error: reorderError } = await dbClient
      .rpc('reorder_pins', {
        p_user_id: user.id,
        p_task_id: taskId,
        p_new_order: newOrder
      })

    if (reorderError) {
      console.error('Reorder error:', reorderError)
      return NextResponse.json(
        { error: 'Failed to reorder pins' },
        { status: 500 }
      )
    }

    // Get updated pin orders for verification
    const { data: updatedPins, error: fetchError } = await dbClient
      .from('task_pins')
      .select('task_id, pin_order')
      .eq('user_id', user.id)
      .order('pin_order', { ascending: true })

    if (fetchError) {
      console.error('Fetch updated pins error:', fetchError)
      // Don't fail the request - reorder likely succeeded
    }

    return NextResponse.json({
      success: true,
      message: 'Pins reordered successfully',
      taskId,
      newOrder,
      updatedPins: updatedPins || []
    })

  } catch (error) {
    console.error('Unexpected error in reorder pins endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}