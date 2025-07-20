import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
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
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
      if (cookieError) {
        authError = cookieError
      } else {
        user = cookieUser
      }
    }
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get aggregated knowledge from all processed notes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('analysis, transcription, recorded_at, processed_at')
      .eq('user_id', user.id)
      .not('analysis', 'is', null)
      .order('recorded_at', { ascending: false })

    if (notesError) {
      console.error('Failed to fetch notes:', notesError)
      return NextResponse.json(
        { error: 'Failed to fetch knowledge data' },
        { status: 500 }
      )
    }

    // Get project knowledge record
    const { data: projectKnowledge, error: knowledgeError } = await supabase
      .from('project_knowledge')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (knowledgeError && knowledgeError.code !== 'PGRST116') {
      console.error('Failed to fetch project knowledge:', knowledgeError)
    }

    // Aggregate data from all notes
    const aggregatedData = aggregateKnowledgeFromNotes(notes || [])

    return NextResponse.json({
      success: true,
      knowledge: {
        ...aggregatedData,
        projectKnowledge: projectKnowledge?.content || {},
        lastUpdated: projectKnowledge?.updated_at || new Date().toISOString(),
      }
    })

  } catch (error) {
    console.error('Knowledge API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
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
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser()
      if (cookieError) {
        authError = cookieError
      } else {
        user = cookieUser
      }
    }
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'object') {
      return NextResponse.json(
        { error: 'Invalid content provided' },
        { status: 400 }
      )
    }

    // Update or create project knowledge
    const { data: knowledge, error: updateError } = await supabase
      .from('project_knowledge')
      .upsert({
        user_id: user.id,
        content,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update knowledge:', updateError)
      return NextResponse.json(
        { error: 'Failed to update knowledge' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      knowledge
    })

  } catch (error) {
    console.error('Knowledge update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function aggregateKnowledgeFromNotes(notes: any[]) {
  const stats = {
    totalNotes: notes.length,
    totalInsights: 0,
    totalTasks: 0,
    totalMessages: 0,
    totalOutreach: 0,
    sentimentDistribution: {
      positive: 0,
      neutral: 0,
      negative: 0,
    },
    timeRange: {
      earliest: null as string | null,
      latest: null as string | null,
    },
  }

  const aggregatedContent = {
    recentInsights: [] as string[],
    topTopics: {} as Record<string, number>,
    keyContacts: {} as Record<string, number>,
    commonTasks: {} as Record<string, number>,
    sentimentTrends: [] as Array<{date: string, sentiment: string}>,
    knowledgeTimeline: [] as Array<{
      date: string,
      type: string,
      content: string,
      noteId: string
    }>,
  }

  for (const note of notes) {
    const analysis = note.analysis
    if (!analysis) continue

    // Update stats
    if (analysis.keyIdeas) {
      stats.totalInsights += analysis.keyIdeas.length
      aggregatedContent.recentInsights.push(...analysis.keyIdeas)
    }

    if (analysis.tasks?.myTasks) {
      stats.totalTasks += analysis.tasks.myTasks.length
      analysis.tasks.myTasks.forEach((task: string) => {
        aggregatedContent.commonTasks[task] = (aggregatedContent.commonTasks[task] || 0) + 1
      })
    }

    if (analysis.tasks?.delegatedTasks) {
      stats.totalTasks += analysis.tasks.delegatedTasks.length
    }

    if (analysis.messagesToDraft) {
      stats.totalMessages += analysis.messagesToDraft.length
    }

    if (analysis.outreachIdeas) {
      stats.totalOutreach += analysis.outreachIdeas.length
      analysis.outreachIdeas.forEach((idea: any) => {
        aggregatedContent.keyContacts[idea.contact] = (aggregatedContent.keyContacts[idea.contact] || 0) + 1
      })
    }

    // Sentiment distribution
    if (analysis.sentiment?.classification) {
      const sentiment = analysis.sentiment.classification.toLowerCase()
      if (sentiment in stats.sentimentDistribution) {
        stats.sentimentDistribution[sentiment as keyof typeof stats.sentimentDistribution]++
      }
      
      aggregatedContent.sentimentTrends.push({
        date: note.recorded_at,
        sentiment: analysis.sentiment.classification
      })
    }

    // Topics
    if (analysis.focusTopics?.primary) {
      aggregatedContent.topTopics[analysis.focusTopics.primary] = 
        (aggregatedContent.topTopics[analysis.focusTopics.primary] || 0) + 1
    }

    if (analysis.focusTopics?.minor) {
      analysis.focusTopics.minor.forEach((topic: string) => {
        aggregatedContent.topTopics[topic] = (aggregatedContent.topTopics[topic] || 0) + 1
      })
    }

    // Timeline
    if (analysis.keyIdeas?.length > 0) {
      aggregatedContent.knowledgeTimeline.push({
        date: note.recorded_at,
        type: 'insight',
        content: analysis.keyIdeas[0], // Just the first insight for timeline
        noteId: note.id
      })
    }

    // Time range
    if (!stats.timeRange.earliest || note.recorded_at < stats.timeRange.earliest) {
      stats.timeRange.earliest = note.recorded_at
    }
    if (!stats.timeRange.latest || note.recorded_at > stats.timeRange.latest) {
      stats.timeRange.latest = note.recorded_at
    }
  }

  // Sort and limit aggregated content
  aggregatedContent.recentInsights = aggregatedContent.recentInsights
    .slice(-50) // Keep last 50 insights
    .reverse()

  aggregatedContent.knowledgeTimeline = aggregatedContent.knowledgeTimeline
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20) // Keep last 20 timeline items

  aggregatedContent.sentimentTrends = aggregatedContent.sentimentTrends
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30) // Keep last 30 for trend analysis

  return {
    stats,
    content: aggregatedContent,
    generatedAt: new Date().toISOString()
  }
}