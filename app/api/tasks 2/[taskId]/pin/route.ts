import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params
    
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

    // Check if task is already pinned
    const { data: existingPin, error: checkError } = await supabase
      .from('task_pins')
      .select('id')
      .eq('user_id', user.id)
      .eq('task_id', taskId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing pin:', checkError)
      return NextResponse.json(
        { success: false, error: 'Failed to check pin status' },
        { status: 500 }
      )
    }

    if (existingPin) {
      return NextResponse.json(
        { success: true, message: 'Task already pinned' }
      )
    }

    // Check pin limit (max 10 pins per user)
    const { count: pinCount, error: countError } = await supabase
      .from('task_pins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countError) {
      console.error('Error counting pins:', countError)
      return NextResponse.json(
        { success: false, error: 'Failed to check pin limit' },
        { status: 500 }
      )
    }

    if ((pinCount || 0) >= 10) {
      return NextResponse.json(
        { success: false, error: 'Pin limit exceeded. You can only pin up to 10 tasks at a time.' },
        { status: 400 }
      )
    }

    // Get the next pin order
    const { data: maxOrderData, error: maxOrderError } = await supabase
      .from('task_pins')
      .select('pin_order')
      .eq('user_id', user.id)
      .order('pin_order', { ascending: false })
      .limit(1)

    if (maxOrderError) {
      console.error('Error getting max pin order:', maxOrderError)
      return NextResponse.json(
        { success: false, error: 'Failed to determine pin order' },
        { status: 500 }
      )
    }

    const nextOrder = (maxOrderData?.[0]?.pin_order || 0) + 1

    // Pin the task
    const { error: pinError } = await supabase
      .from('task_pins')
      .insert({
        user_id: user.id,
        task_id: taskId,
        pin_order: nextOrder
      })

    if (pinError) {
      console.error('Error pinning task:', pinError)
      return NextResponse.json(
        { success: false, error: 'Failed to pin task' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Task pinned successfully',
      pinOrder: nextOrder
    })

  } catch (error) {
    console.error('Error in POST /api/tasks/[taskId]/pin:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params
    
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

    // Unpin the task
    const { error: unpinError } = await supabase
      .from('task_pins')
      .delete()
      .eq('user_id', user.id)
      .eq('task_id', taskId)

    if (unpinError) {
      console.error('Error unpinning task:', unpinError)
      return NextResponse.json(
        { success: false, error: 'Failed to unpin task' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Task unpinned successfully'
    })

  } catch (error) {
    console.error('Error in DELETE /api/tasks/[taskId]/pin:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}