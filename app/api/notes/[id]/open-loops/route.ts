import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/notes/[id]/open-loops - Get open loops for a note
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params
    const supabase = await createServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get open loops for this note (RLS ensures user can only see their own)
    const { data, error } = await supabase
      .from('open_loops')
      .select('*')
      .eq('note_id', noteId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching open loops:', error)
      return NextResponse.json(
        { error: 'Failed to fetch open loops' },
        { status: 500 }
      )
    }

    return NextResponse.json({ openLoops: data || [] })
  } catch (error) {
    console.error('Error in GET /api/notes/[id]/open-loops:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
