import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/supabase-server'
import { CACHE_CONFIGS, getCachedProcessedContent } from '@/lib/cache/response-cache'

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request (handles both Bearer token and cookie auth)
    const { user, error: authError, client: supabase } = await authenticateRequest(request)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')

    // Select specific columns to avoid unnecessary data transfer
    const noteColumns = 'id, user_id, audio_url, duration_seconds, transcription, analysis, recorded_at, processed_at, created_at'

    let query = supabase
      .from('notes')
      .select(noteColumns)
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add search if provided
    if (search) {
      query = query.textSearch('transcription', search)
    }

    const { data: notes, error: dbError } = await query

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to fetch notes' },
        { status: 500 }
      )
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (search) {
      countQuery = countQuery.textSearch('transcription', search)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Count error:', countError)
    }

    const response = {
      notes,
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      }
    }
    
    // Determine last modified date for caching
    const lastModified = notes && notes.length > 0 
      ? Math.max(
          ...notes.map(n => new Date(n.updated_at || n.recorded_at).getTime())
        )
      : Date.now()
    
    // Return cached response with appropriate headers
    return getCachedProcessedContent(
      response,
      new Date(lastModified),
      CACHE_CONFIGS.NOTES,
      request.headers
    )

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request (handles both Bearer token and cookie auth)
    const { user, error: authError, client: supabase } = await authenticateRequest(request)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { audio_url, duration_seconds, transcription, analysis } = body

    if (!audio_url) {
      return NextResponse.json(
        { error: 'audio_url is required' },
        { status: 400 }
      )
    }

    const { data: note, error: dbError } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        audio_url,
        duration_seconds,
        transcription,
        analysis,
        recorded_at: new Date().toISOString(),
      })
      .select('id, user_id, audio_url, duration_seconds, transcription, analysis, recorded_at, processed_at, created_at')
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create note' },
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