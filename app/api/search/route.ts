import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/supabase-server'
import { CACHE_CONFIGS, getCachedProcessedContent } from '@/lib/cache/response-cache'
import type { ExtendedAnalysis } from '@/lib/types/api'

// Force dynamic behavior to handle cookies and searchParams
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface SearchResult {
  id: string
  title: string
  snippet: string
  type: 'note' | 'transcription' | 'analysis'
  sentiment?: string
  recordedAt: string
  relevanceScore: number
}

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

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type') // 'note', 'transcription', 'analysis'
    const sentiment = searchParams.get('sentiment') // 'positive', 'negative', 'neutral'

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        results: [],
        total: 0,
        query: ''
      })
    }

    const searchQuery = query.trim()
    console.log(`Searching for: "${searchQuery}" (user: ${user.id})`)

    // Build the search query using PostgreSQL full-text search
    let dbQuery = supabase
      .from('notes')
      .select(`
        id,
        transcription,
        analysis,
        recorded_at,
        duration_seconds
      `)
      .eq('user_id', user.id)
      .not('transcription', 'is', null) // Only include notes with transcription

    // Use PostgreSQL full-text search
    dbQuery = dbQuery.textSearch('transcription', searchQuery, {
      type: 'websearch',
      config: 'english'
    })

    // Add filters
    if (sentiment) {
      dbQuery = dbQuery.eq('analysis->sentiment->>classification', sentiment)
    }

    // Execute the query
    const { data: notes, error: searchError } = await dbQuery
      .range(offset, offset + limit - 1)
      .order('recorded_at', { ascending: false })

    if (searchError) {
      console.error('Search error:', searchError)
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      )
    }

    if (!notes || notes.length === 0) {
      return NextResponse.json({
        results: [],
        total: 0,
        query: searchQuery
      })
    }

    // Process and rank results
    const results: SearchResult[] = []

    for (const note of notes) {
      // Search in transcription
      if (note.transcription && includesQuery(note.transcription, searchQuery)) {
        results.push({
          id: note.id,
          title: generateTitle(note.transcription, note.analysis),
          snippet: generateSnippet(note.transcription, searchQuery),
          type: 'transcription',
          sentiment: note.analysis?.sentiment?.classification,
          recordedAt: note.recorded_at,
          relevanceScore: calculateRelevanceScore(note.transcription, searchQuery)
        })
      }

      // Search in analysis
      if (note.analysis && !type && searchInAnalysis(note.analysis, searchQuery)) {
        const analysisSnippet = generateAnalysisSnippet(note.analysis, searchQuery)
        if (analysisSnippet) {
          results.push({
            id: note.id,
            title: generateTitle(note.transcription, note.analysis),
            snippet: analysisSnippet,
            type: 'analysis',
            sentiment: note.analysis?.sentiment?.classification,
            recordedAt: note.recorded_at,
            relevanceScore: calculateAnalysisRelevanceScore(note.analysis, searchQuery)
          })
        }
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = results
      .filter((result, index, self) => 
        index === self.findIndex(r => r.id === result.id && r.type === result.type)
      )
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .textSearch('transcription', searchQuery, {
        type: 'websearch',
        config: 'english'
      })

    const response = {
      results: uniqueResults,
      total: count || 0,
      query: searchQuery,
      pagination: {
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    }
    
    // Determine last modified date for caching (search results can be cached for a short time)
    const lastModified = notes && notes.length > 0 
      ? Math.max(
          ...notes.map(n => new Date(n.updated_at || n.recorded_at).getTime())
        )
      : Date.now()
    
    // Return cached response with appropriate headers
    return getCachedProcessedContent(
      response,
      new Date(lastModified),
      CACHE_CONFIGS.SEARCH,
      request.headers
    )

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions
function includesQuery(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase())
}

function generateTitle(transcription?: string, analysis?: ExtendedAnalysis): string {
  // Try to get title from analysis primary topic
  if (analysis?.focusTopics?.primary) {
    return analysis.focusTopics.primary
  }
  
  // Fallback to first sentence of transcription
  if (transcription) {
    const firstSentence = transcription.split(/[.!?]/)[0].trim()
    return firstSentence.length > 50 
      ? firstSentence.substring(0, 50) + '...'
      : firstSentence || 'Voice Note'
  }
  
  return 'Voice Note'
}

function generateSnippet(text: string, query: string, maxLength: number = 150): string {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  // Find the position of the query in the text
  const queryIndex = lowerText.indexOf(lowerQuery)
  
  if (queryIndex === -1) {
    // If query not found, return beginning of text
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }
  
  // Calculate snippet boundaries
  const start = Math.max(0, queryIndex - 50)
  const end = Math.min(text.length, queryIndex + query.length + 100)
  
  let snippet = text.substring(start, end)
  
  // Add ellipsis if we cut off text
  if (start > 0) snippet = '...' + snippet
  if (end < text.length) snippet = snippet + '...'
  
  return snippet
}

function calculateRelevanceScore(text: string, query: string): number {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  let score = 0
  
  // Exact phrase match gets highest score
  if (lowerText.includes(lowerQuery)) {
    score += 10
  }
  
  // Word matches
  const queryWords = lowerQuery.split(/\s+/)
  const textWords = lowerText.split(/\s+/)
  
  for (const queryWord of queryWords) {
    const wordCount = textWords.filter(word => word.includes(queryWord)).length
    score += wordCount * 2
  }
  
  // Boost score if query appears early in text
  const queryIndex = lowerText.indexOf(lowerQuery)
  if (queryIndex >= 0 && queryIndex < 100) {
    score += 5
  }
  
  return score
}

function searchInAnalysis(analysis: ExtendedAnalysis, query: string): boolean {
  const searchableText = JSON.stringify(analysis).toLowerCase()
  return searchableText.includes(query.toLowerCase())
}

function generateAnalysisSnippet(analysis: ExtendedAnalysis, query: string): string {
  const lowerQuery = query.toLowerCase()
  
  // Search in different analysis sections
  const sections = [
    { name: 'Key Ideas', content: analysis.keyIdeas?.join(' ') },
    { name: 'Tasks', content: analysis.tasks?.myTasks?.join(' ') + ' ' + 
      analysis.tasks?.delegatedTasks?.map((t) => typeof t === 'string' ? t : (t as any).task).join(' ') },
    { name: 'Messages', content: analysis.messagesToDraft?.map((m) => 
      `${(m as any).subject || ''} ${(m as any).body || (m as any).content || ''}`).join(' ') },
    { name: 'Sentiment', content: analysis.sentiment?.explanation },
    { name: 'Outreach', content: analysis.outreachIdeas?.map((o) => 
      `${(o as any).contact || (o as any).person || ''} ${(o as any).topic || (o as any).reason || ''} ${(o as any).purpose || ''}`).join(' ') }
  ]
  
  for (const section of sections) {
    if (section.content && section.content.toLowerCase().includes(lowerQuery)) {
      return `${section.name}: ${generateSnippet(section.content, query, 100)}`
    }
  }
  
  return 'Found in analysis'
}

function calculateAnalysisRelevanceScore(analysis: ExtendedAnalysis, query: string): number {
  const analysisText = JSON.stringify(analysis).toLowerCase()
  const lowerQuery = query.toLowerCase()
  
  let score = 0
  
  // Count occurrences in analysis
  const matches = (analysisText.match(new RegExp(lowerQuery, 'g')) || []).length
  score += matches * 3
  
  // Boost if found in key sections
  if (analysis.keyIdeas?.some((idea: string) => 
    idea.toLowerCase().includes(lowerQuery))) {
    score += 5
  }
  
  if (analysis.focusTopics?.primary?.toLowerCase().includes(lowerQuery)) {
    score += 8
  }
  
  return score
}