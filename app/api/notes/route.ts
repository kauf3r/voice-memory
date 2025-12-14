import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { CACHE_CONFIGS, getCachedProcessedContent } from '@/lib/cache/response-cache'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Try to get user from Authorization header first
    let user = null
    let authError = null
    
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data, error } = await supabase.auth.getUser(token)
      
      if (error) {
        authError = error
      } else {
        user = data?.user
        // Set the session for this request
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: token
        })
      }
    }
    
    // If no auth header or it failed, try to get from cookies
    if (!user) {
      const { data: { user: cookieUser }, error } = await supabase.auth.getUser()
      user = cookieUser
      authError = error
    }
    
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

    let query = supabase
      .from('notes')
      .select('*')
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
    const supabase = await createServerClient()
    
    // Try to get user from Authorization header first
    let user = null
    let authError = null
    
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data, error } = await supabase.auth.getUser(token)
      
      if (error) {
        authError = error
      } else {
        user = data?.user
        // Set the session for this request
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: token
        })
      }
    }
    
    // If no auth header or it failed, try to get from cookies
    if (!user) {
      const { data: { user: cookieUser }, error } = await supabase.auth.getUser()
      user = cookieUser
      authError = error
    }
    
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
      .select()
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