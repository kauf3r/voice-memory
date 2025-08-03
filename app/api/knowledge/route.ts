import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import { TaskStateService } from '@/lib/services/TaskStateService'

// Force dynamic behavior to handle cookies and searchParams
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  console.log('🔍 Knowledge API - GET request started')
  console.log('📊 Environment check:', {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    timestamp: new Date().toISOString()
  })
  
  try {
    // Get user from Authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    console.log('📋 Auth header analysis:', {
      present: !!authHeader,
      startsWithBearer: authHeader?.startsWith('Bearer '),
      length: authHeader?.length || 0
    })
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.split(' ')[1]
    console.log('🎟️ Token analysis:', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 20) + '...',
      tokenEnd: '...' + token.substring(token.length - 20)
    })
    
    // Check if service key exists, if not use anon key with RLS
    if (!process.env.SUPABASE_SERVICE_KEY) {
      console.warn('⚠️ SUPABASE_SERVICE_KEY not found, using anon key with RLS')
    }
    
    // Create service client for authentication - fallback to anon key if service key not available
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    console.log('🔐 Attempting to validate token...')
    
    let user = null
    let authError = null
    
    if (process.env.SUPABASE_SERVICE_KEY) {
      // If we have a service key, use it to validate the token
      const { data: { user: serviceUser }, error: serviceError } = await supabase.auth.getUser(token)
      user = serviceUser
      authError = serviceError
    } else {
      // If using anon key, create a new client with the user's token
      console.log('📝 Using anon key - creating authenticated client')
      const authenticatedClient = createClient(
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
      
      const { data: { user: anonUser }, error: anonError } = await authenticatedClient.auth.getUser()
      user = anonUser
      authError = anonError
    }
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', {
        error: authError,
        hasUser: !!user,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      })
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      )
    }
    
    console.log('✅ User authenticated:', {
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      authMethod: process.env.SUPABASE_SERVICE_KEY ? 'service' : 'anon'
    })

    // Use the authenticated client for database queries when using anon key
    const dbClient = process.env.SUPABASE_SERVICE_KEY ? supabase : createClient(
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
    
    // Get aggregated knowledge from all processed notes
    console.log('🔍 Querying notes table for user:', user.id)
    const { data: notes, error: notesError } = await dbClient
      .from('notes')
      .select('id, analysis, transcription, recorded_at, processed_at')
      .eq('user_id', user.id)
      .not('analysis', 'is', null)
      .order('recorded_at', { ascending: false })

    console.log('📊 Notes query result:', {
      error: notesError,
      notesCount: notes?.length || 0,
      hasNotes: !!notes,
      sampleNoteIds: notes?.slice(0, 3).map(n => n.id) || []
    })

    // Get task states for this user using TaskStateService
    console.log('🔍 Querying task_states table for user:', user.id)
    const taskStateService = new TaskStateService(dbClient)
    let taskStates = []
    let taskStatesError = null
    
    try {
      // Get all task states for the user (completed, pinned, etc.)
      taskStates = await taskStateService.getTaskStates({
        user_id: user.id
      })
      console.log('📊 Task states query result:', {
        taskStatesCount: taskStates.length,
        hasTaskStates: !!taskStates
      })
    } catch (error) {
      taskStatesError = error
      console.warn('⚠️ Could not fetch task states:', error instanceof Error ? error.message : 'Unknown error')
    }

    // Create a completion lookup map from task states
    const completionMap = new Map()
    if (taskStates) {
      taskStates
        .filter(ts => ts.completed) // Only include completed tasks
        .forEach(taskState => {
          completionMap.set(taskState.task_id, {
            completedAt: taskState.completed_at,
            completedBy: taskState.completed_by,
            completionNotes: taskState.completion_notes
          })
        })
    }
    console.log('📊 Completion map created with', completionMap.size, 'entries')

    if (notesError) {
      console.error('❌ Failed to fetch notes:', notesError)
      return NextResponse.json(
        { error: 'Failed to fetch knowledge data' },
        { status: 500 }
      )
    }
    
    console.log(`📊 Found ${notes?.length || 0} notes with analysis for user ${user.id}`)
    
    // Log sample of note structure if notes exist
    if (notes && notes.length > 0) {
      const sampleNote = notes[0]
      console.log('📝 Sample note structure:', {
        id: sampleNote.id,
        hasAnalysis: !!sampleNote.analysis,
        hasTranscription: !!sampleNote.transcription,
        recorded_at: sampleNote.recorded_at,
        processed_at: sampleNote.processed_at,
        analysisKeys: sampleNote.analysis ? Object.keys(sampleNote.analysis) : []
      })
    }

    // Get project knowledge record
    const { data: projectKnowledge, error: knowledgeError } = await dbClient
      .from('project_knowledge')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (knowledgeError && knowledgeError.code !== 'PGRST116') {
      console.error('Failed to fetch project knowledge:', knowledgeError)
    }

    // Aggregate data from all notes with error handling
    let aggregatedData
    try {
      // Handle empty notes case
      if (!notes || notes.length === 0) {
        console.log('📭 No notes found, returning empty knowledge base')
        aggregatedData = {
          stats: {
            totalNotes: 0,
            totalInsights: 0,
            totalTasks: 0,
            totalMessages: 0,
            totalOutreach: 0,
            sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
            timeRange: { earliest: null, latest: null }
          },
          content: {
            recentInsights: [],
            topTopics: {},
            keyContacts: {},
            commonTasks: {},
            sentimentTrends: [],
            knowledgeTimeline: []
          },
          generatedAt: new Date().toISOString()
        }
      } else {
        console.log('🔄 Starting knowledge aggregation from', notes.length, 'notes')
        console.log('📊 Pre-aggregation data check:', {
          notesWithAnalysis: notes.filter(n => n.analysis).length,
          firstNoteAnalysisKeys: notes[0]?.analysis ? Object.keys(notes[0].analysis) : 'no analysis',
          completionMapSize: completionMap.size
        })
        
        aggregatedData = aggregateKnowledgeFromNotes(notes, completionMap)
        
        console.log('✅ Knowledge aggregation complete:', {
          totalNotes: aggregatedData.stats.totalNotes,
          totalInsights: aggregatedData.stats.totalInsights,
          totalTasks: aggregatedData.stats.totalTasks,
          recentInsightsCount: aggregatedData.content.recentInsights.length,
          topTopicsCount: Object.keys(aggregatedData.content.topTopics).length,
          allTasksCount: aggregatedData.content.allTasks?.length || 0
        })
      }
    } catch (aggregateError) {
      console.error('❌ Error aggregating knowledge data:', {
        error: aggregateError,
        message: aggregateError.message,
        stack: aggregateError.stack,
        notesCount: notes?.length || 0
      })
      // Return a safe default structure
      aggregatedData = {
        stats: {
          totalNotes: notes?.length || 0,
          totalInsights: 0,
          totalTasks: 0,
          totalMessages: 0,
          totalOutreach: 0,
          sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
          timeRange: { earliest: null, latest: null }
        },
        content: {
          recentInsights: [],
          topTopics: {},
          keyContacts: {},
          commonTasks: {},
          sentimentTrends: [],
          knowledgeTimeline: []
        },
        generatedAt: new Date().toISOString()
      }
    }

    const response = {
      success: true,
      knowledge: {
        ...aggregatedData,
        projectKnowledge: projectKnowledge?.content || {},
        lastUpdated: projectKnowledge?.updated_at || new Date().toISOString(),
      }
    }
    
    console.log('📤 Final response preparation:', {
      hasAggregatedData: !!aggregatedData,
      aggregatedDataKeys: aggregatedData ? Object.keys(aggregatedData) : [],
      statsExists: !!aggregatedData?.stats,
      contentExists: !!aggregatedData?.content,
      projectKnowledgeExists: !!projectKnowledge,
      responseSize: JSON.stringify(response).length
    })
    
    console.log('📤 Returning knowledge response with stats:', {
      totalNotes: aggregatedData.stats.totalNotes,
      totalInsights: aggregatedData.stats.totalInsights,
      totalTasks: aggregatedData.stats.totalTasks,
      hasContent: !!aggregatedData.content,
      contentKeys: aggregatedData.content ? Object.keys(aggregatedData.content) : []
    })
    
    return NextResponse.json(response)

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
      
      // Use a new client with the token for authentication
      const tokenClient = createClient(
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
      
      const { data, error } = await tokenClient.auth.getUser()
      
      if (error) {
        authError = error
      } else {
        user = data?.user
      }
    }
    
    // If no auth header or it failed, try to get from cookies
    if (!user) {
      const { data, error: cookieError } = await supabase.auth.getUser()
      if (cookieError) {
        authError = cookieError
      } else {
        user = data?.user
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

function aggregateKnowledgeFromNotes(notes: any[], completionMap: Map<string, any> = new Map()) {
  console.log('🔧 aggregateKnowledgeFromNotes called with:', {
    notesCount: notes.length,
    completionMapSize: completionMap.size,
    firstNoteId: notes[0]?.id,
    firstNoteHasAnalysis: !!notes[0]?.analysis
  })
  
  const stats = {
    totalNotes: notes.length,
    totalInsights: 0,
    totalTasks: 0,
    totalMessages: 0,
    totalOutreach: 0,
    completedTasks: 0,
    taskCompletionRate: 0,
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
    allTasks: [] as Array<{
      id: string,
      description: string,
      type: 'myTasks' | 'delegatedTasks',
      date: string,
      noteId: string,
      noteContext?: string,
      nextSteps?: string,
      assignedTo?: string,
      completed: boolean,
      completedAt?: string,
      completedBy?: string,
      completionNotes?: string
    }>,
    sentimentTrends: [] as Array<{date: string, sentiment: string}>,
    knowledgeTimeline: [] as Array<{
      date: string,
      type: string,
      content: string,
      noteId: string
    }>,
  }

  console.log('🔄 Processing', notes.length, 'notes for aggregation')
  let processedNotesCount = 0
  let notesWithoutAnalysis = 0
  
  for (const note of notes) {
    try {
      const analysis = note.analysis
      if (!analysis) {
        notesWithoutAnalysis++
        continue
      }
      
      processedNotesCount++
      console.log(`📝 Processing note ${processedNotesCount}/${notes.length}:`, {
        noteId: note.id,
        analysisKeys: Object.keys(analysis),
        hasKeyIdeas: !!analysis.keyIdeas,
        keyIdeasCount: analysis.keyIdeas?.length || 0
      })

      // Update stats
      if (analysis.keyIdeas) {
        stats.totalInsights += analysis.keyIdeas.length
        aggregatedContent.recentInsights.push(...analysis.keyIdeas)
        console.log(`  ✅ Added ${analysis.keyIdeas.length} insights, total: ${stats.totalInsights}`)
      }

      if (analysis.tasks?.myTasks) {
        stats.totalTasks += analysis.tasks.myTasks.length
        analysis.tasks.myTasks.forEach((task: string | object, index: number) => {
          // Handle both string and object tasks
          const taskDescription = typeof task === 'string' ? task : (task as any).task || 'Unknown task'
          const taskDetails = typeof task === 'object' ? task as any : null
          
          aggregatedContent.commonTasks[taskDescription] = (aggregatedContent.commonTasks[taskDescription] || 0) + 1
          const taskId = `${note.id}-my-${index}`
          const completion = completionMap.get(taskId)
          
          aggregatedContent.allTasks.push({
            id: taskId,
            description: taskDescription,
            type: 'myTasks',
            date: note.recorded_at,
            noteId: note.id,
            noteContext: analysis.keyIdeas?.[0] || note.transcription?.substring(0, 100) || 'No context available',
            nextSteps: taskDetails?.nextSteps,
            assignedTo: taskDetails?.assignedTo,
            completed: !!completion,
            completedAt: completion?.completedAt,
            completedBy: completion?.completedBy,
            completionNotes: completion?.completionNotes
          })
        })
      }

      if (analysis.tasks?.delegatedTasks) {
        stats.totalTasks += analysis.tasks.delegatedTasks.length
        analysis.tasks.delegatedTasks.forEach((task: string | object, index: number) => {
          // Handle both string and object tasks
          const taskDescription = typeof task === 'string' ? task : (task as any).task || 'Unknown task'
          const taskDetails = typeof task === 'object' ? task as any : null
          
          const taskId = `${note.id}-delegated-${index}`
          const completion = completionMap.get(taskId)
          
          aggregatedContent.allTasks.push({
            id: taskId,
            description: taskDescription,
            type: 'delegatedTasks',
            date: note.recorded_at,
            noteId: note.id,
            noteContext: analysis.keyIdeas?.[0] || note.transcription?.substring(0, 100) || 'No context available',
            nextSteps: taskDetails?.nextSteps,
            assignedTo: taskDetails?.assignedTo,
            completed: !!completion,
            completedAt: completion?.completedAt,
            completedBy: completion?.completedBy,
            completionNotes: completion?.completionNotes
          })
        })
      }

      if (analysis.messagesToDraft) {
        stats.totalMessages += analysis.messagesToDraft.length
      }

      if (analysis.outreachIdeas) {
        stats.totalOutreach += analysis.outreachIdeas.length
        analysis.outreachIdeas.forEach((idea: any) => {
          if (idea.contact) {
            aggregatedContent.keyContacts[idea.contact] = (aggregatedContent.keyContacts[idea.contact] || 0) + 1
          }
        })
      }

      // Handle structured data people (new format) with backward compatibility
      if (analysis.structuredData?.people) {
        analysis.structuredData.people.forEach((person: any) => {
          if (person.name) {
            aggregatedContent.keyContacts[person.name] = (aggregatedContent.keyContacts[person.name] || 0) + 1
          }
        })
      }

      // Handle message drafts for contacts
      if (analysis.messagesToDraft) {
        analysis.messagesToDraft.forEach((message: any) => {
          if (message.recipient) {
            aggregatedContent.keyContacts[message.recipient] = (aggregatedContent.keyContacts[message.recipient] || 0) + 1
          }
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
    } catch (noteError) {
      console.error('Error processing note:', note.id, noteError)
      // Continue with next note instead of failing completely
      continue
    }
  }

  // Sort and limit aggregated content
  aggregatedContent.recentInsights = aggregatedContent.recentInsights
    .slice(-50) // Keep last 50 insights
    .reverse()

  aggregatedContent.allTasks = aggregatedContent.allTasks
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  aggregatedContent.knowledgeTimeline = aggregatedContent.knowledgeTimeline
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20) // Keep last 20 timeline items

  aggregatedContent.sentimentTrends = aggregatedContent.sentimentTrends
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30) // Keep last 30 for trend analysis

  // Calculate completion statistics
  stats.completedTasks = aggregatedContent.allTasks.filter(task => task.completed).length
  stats.taskCompletionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0

  console.log('🎯 Aggregation summary:', {
    totalNotesProcessed: notes.length,
    notesWithAnalysis: processedNotesCount,
    notesWithoutAnalysis: notesWithoutAnalysis,
    finalStats: {
      totalInsights: stats.totalInsights,
      totalTasks: stats.totalTasks,
      totalMessages: stats.totalMessages,
      totalOutreach: stats.totalOutreach,
      completedTasks: stats.completedTasks
    },
    finalContent: {
      recentInsightsCount: aggregatedContent.recentInsights.length,
      topTopicsCount: Object.keys(aggregatedContent.topTopics).length,
      keyContactsCount: Object.keys(aggregatedContent.keyContacts).length,
      allTasksCount: aggregatedContent.allTasks.length,
      timelineItemsCount: aggregatedContent.knowledgeTimeline.length
    }
  })

  return {
    stats,
    content: aggregatedContent,
    generatedAt: new Date().toISOString()
  }
}