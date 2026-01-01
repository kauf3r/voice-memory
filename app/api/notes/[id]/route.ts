import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    // Get auth token from header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    let user = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data, error } = await supabase.auth.getUser(token)
      
      if (!error && data?.user) {
        user = data.user
        // Set the session for this request
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: token
        })
      }
    }
    
    // If no auth header, try cookies
    if (!user) {
      const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
      user = cookieUser
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication failed. Please log in.' },
        { status: 401 }
      )
    }

    const { data: note, error: dbError } = await supabase
      .from('notes')
      .select('id, user_id, audio_url, duration_seconds, transcription, analysis, recorded_at, processed_at, created_at')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (dbError) {
      if (dbError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Note not found' },
          { status: 404 }
        )
      }
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to fetch note' },
        { status: 500 }
      )
    }

    return NextResponse.json(note)

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    // Get auth token from header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    let user = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data, error } = await supabase.auth.getUser(token)
      
      if (!error && data?.user) {
        user = data.user
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: token
        })
      }
    }
    
    // If no auth header, try cookies
    if (!user) {
      const { data: { user: cookieUser } } = await supabase.auth.getUser()
      user = cookieUser
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication failed. Please log in.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { transcription, analysis, processed_at } = body

    const { data: note, error: dbError } = await supabase
      .from('notes')
      .update({
        transcription,
        analysis,
        processed_at,
      })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select('id, user_id, audio_url, duration_seconds, transcription, analysis, recorded_at, processed_at, created_at')
      .single()

    if (dbError) {
      if (dbError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Note not found' },
          { status: 404 }
        )
      }
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to update note' },
        { status: 500 }
      )
    }

    return NextResponse.json(note)

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient()
    
    // Get auth token from header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    let user = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data, error } = await supabase.auth.getUser(token)
      
      if (!error && data?.user) {
        user = data.user
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: token
        })
      }
    }
    
    // If no auth header, try cookies
    if (!user) {
      const { data: { user: cookieUser } } = await supabase.auth.getUser()
      user = cookieUser
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication failed. Please log in.' },
        { status: 401 }
      )
    }

    // First get the note to check ownership and get file path
    const { data: note, error: fetchError } = await supabase
      .from('notes')
      .select('audio_url')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Note not found' },
          { status: 404 }
        )
      }
      console.error('Database error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch note' },
        { status: 500 }
      )
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('notes')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to delete note' },
        { status: 500 }
      )
    }

    // TODO: Delete audio file from storage
    // This would require extracting the file path from audio_url
    // and calling supabase.storage.from('audio-files').remove([filePath])

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}