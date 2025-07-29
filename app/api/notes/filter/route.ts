import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// Force dynamic behavior to handle cookies and searchParams
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Try to get user from Authorization header first
    let user = null
    let authError = null
    
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    console.log('Filter API - Auth header present:', !!authHeader)
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      console.log('Filter API - Token length:', token.length)
      
      try {
        const { data, error } = await supabase.auth.getUser(token)
        
        if (error) {
          console.log('Filter API - Auth header error:', error.message)
          authError = error
        } else {
          user = data?.user
          console.log('Filter API - Auth header success, user:', user?.id)
        }
      } catch (e) {
        console.log('Filter API - Auth header exception:', e)
        authError = e
      }
    } else {
      console.log('Filter API - No valid auth header found')
    }
    
    // If no auth header or it failed, try to get from cookies
    if (!user) {
      console.log('Filter API - Trying cookie authentication')
      try {
        const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
        if (cookieError) {
          console.log('Filter API - Cookie auth error:', cookieError.message)
          authError = cookieError
        } else {
          console.log('Filter API - Cookie auth success, user:', cookieUser?.id)
          user = cookieUser
        }
      } catch (e) {
        console.log('Filter API - Cookie auth exception:', e)
        authError = e
      }
    }
    
    if (authError || !user) {
      console.log('Final auth failure:', { authError, hasUser: !!user })
      return NextResponse.json(
        { error: 'Unauthorized', details: (authError as any)?.message || 'No user found' },
        { status: 401 }
      )
    }

    // Get filter parameters
    const { searchParams } = new URL(request.url)
    const filterType = searchParams.get('type')
    const filterValue = searchParams.get('value')

    if (!filterType || !filterValue) {
      return NextResponse.json(
        { error: 'Missing filter parameters' },
        { status: 400 }
      )
    }

    // Build query based on filter type
    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .not('analysis', 'is', null)
      .order('recorded_at', { ascending: false })

    // Apply specific filters based on type
    switch (filterType) {
      case 'topic':
        // For topics, we'll do client-side filtering since JSON queries are complex
        // Just get all notes with analysis for this user
        break

      case 'contact':
        // Search in people mentioned and outreach ideas
        query = query.or(
          `analysis->>structuredData->people.cs.[{"name":"${filterValue}"}],` +
          `analysis->>outreachIdeas.cs.[{"contact":"${filterValue}"}],` +
          `analysis->>messagesToDraft.cs.[{"recipient":"${filterValue}"}]`
        )
        break

      case 'sentiment':
        // Filter by sentiment classification
        query = query.eq('analysis->sentiment->>classification', filterValue)
        break

      case 'date':
        // Filter by recording date (assuming filterValue is a date string)
        const startDate = new Date(filterValue)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 1)
        
        query = query
          .gte('recorded_at', startDate.toISOString())
          .lt('recorded_at', endDate.toISOString())
        break

      case 'location':
        // Search in structured data locations
        query = query.ilike('analysis->structuredData->locations', `%${filterValue}%`)
        break

      case 'time':
        // Search in structured data times
        query = query.ilike('analysis->structuredData->times', `%${filterValue}%`)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid filter type' },
          { status: 400 }
        )
    }

    const { data: notes, error: notesError } = await query

    if (notesError) {
      console.error('Failed to fetch filtered notes:', notesError)
      return NextResponse.json(
        { error: 'Failed to fetch notes' },
        { status: 500 }
      )
    }

    // For topic filtering, we need to do additional client-side filtering
    // since PostgreSQL JSON queries can be complex
    let filteredNotes = notes || []
    
    if (filterType === 'topic') {
      filteredNotes = notes?.filter((note) => {
        const analysis = note.analysis
        if (!analysis?.focusTopics) return false

        const primary = analysis.focusTopics.primary?.toLowerCase() || ''
        const minor = analysis.focusTopics.minor || []
        const searchTerm = filterValue.toLowerCase()

        return primary.includes(searchTerm) || 
               minor.some((topic: string) => topic.toLowerCase().includes(searchTerm))
      }) || []
    }

    if (filterType === 'contact') {
      filteredNotes = notes?.filter((note) => {
        const analysis = note.analysis
        if (!analysis) return false

        const searchTerm = filterValue.toLowerCase()

        // Check structured data people
        const people = analysis.structuredData?.people || []
        const hasPerson = people.some((person: any) => 
          person.name?.toLowerCase().includes(searchTerm)
        )

        // Check outreach ideas
        const outreach = analysis.outreachIdeas || []
        const hasOutreach = outreach.some((idea: any) => 
          idea.contact?.toLowerCase().includes(searchTerm)
        )

        // Check message drafts
        const messages = analysis.messagesToDraft || []
        const hasMessage = messages.some((msg: any) => 
          msg.recipient?.toLowerCase().includes(searchTerm)
        )

        return hasPerson || hasOutreach || hasMessage
      }) || []
    }

    return NextResponse.json({
      success: true,
      notes: filteredNotes,
      count: filteredNotes.length,
      filter: {
        type: filterType,
        value: filterValue
      }
    })

  } catch (error) {
    console.error('Filter API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}