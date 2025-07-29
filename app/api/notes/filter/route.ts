import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic behavior to handle cookies and searchParams
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  console.log('🔍 Filter API - GET request started')
  
  try {
    // Get user from Authorization header (matching knowledge API pattern)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    console.log('📋 Filter API - Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Filter API - Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    console.log('🎟️ Filter API - Token received (first 20 chars):', token.substring(0, 20) + '...')
    
    // Create client with the provided token (same pattern as knowledge API)
    const supabase = createClient(
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
    
    console.log('🔐 Filter API - Attempting to validate token with Supabase...')
    const { data, error: authError } = await supabase.auth.getUser()
    
    if (authError || !data?.user) {
      console.error('❌ Filter API - Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const user = data.user
    console.log('✅ Filter API - User authenticated:', user.id)

    // Get filter parameters
    const { searchParams } = new URL(request.url)
    const filterType = searchParams.get('type')
    const filterValue = searchParams.get('value')

    console.log('🔍 Filter parameters:', { filterType, filterValue })

    if (!filterType || !filterValue) {
      console.log('❌ Missing filter parameters')
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
        console.log('📅 Date filter - input value:', filterValue)
        const startDate = new Date(filterValue)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 1)
        
        console.log('📅 Date range:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
        
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

    console.log('📡 Executing database query...')
    const { data: notes, error: notesError } = await query

    if (notesError) {
      console.error('❌ Failed to fetch filtered notes:', notesError)
      return NextResponse.json(
        { error: 'Failed to fetch notes' },
        { status: 500 }
      )
    }
    
    console.log(`📊 Database query returned ${notes?.length || 0} notes`)

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

    console.log(`📤 Filter API - Returning ${filteredNotes.length} filtered notes`)

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