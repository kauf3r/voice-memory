import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// PATCH /api/open-loops/[id] - Update open loop (resolve/unresolve)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { resolved } = body

    if (typeof resolved !== 'boolean') {
      return NextResponse.json(
        { error: 'resolved must be a boolean' },
        { status: 400 }
      )
    }

    // Update the open loop (RLS ensures user can only update their own)
    const { data, error } = await supabase
      .from('open_loops')
      .update({ resolved })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating open loop:', error)
      return NextResponse.json(
        { error: 'Failed to update open loop' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Open loop not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, openLoop: data })
  } catch (error) {
    console.error('Error in PATCH /api/open-loops/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/open-loops/[id] - Delete open loop
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete the open loop (RLS ensures user can only delete their own)
    const { error } = await supabase
      .from('open_loops')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting open loop:', error)
      return NextResponse.json(
        { error: 'Failed to delete open loop' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/open-loops/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
