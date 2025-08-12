import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TrelloExportService, type ExportOptions, type VoiceMemoryTask } from '@/lib/trello-export'

// Force dynamic behavior to handle cookies and searchParams
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  console.log('🔍 Trello Export API - POST request started')
  
  try {
    // Get user from Authorization header (matching knowledge API pattern)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    console.log('📋 Trello Export API - Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Trello Export API - Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    console.log('🎟️ Trello Export API - Token received (first 20 chars):', token.substring(0, 20) + '...')
    
    // Create client with the provided token
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
    
    console.log('🔐 Trello Export API - Attempting to validate token with Supabase...')
    const { data, error: authError } = await supabase.auth.getUser()
    
    if (authError || !data?.user) {
      console.error('❌ Trello Export API - Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const user = data.user
    console.log('✅ Trello Export API - User authenticated:', user.id)

    // Parse request body for export options
    const body = await request.json()
    const exportOptions: ExportOptions = {
      boardName: body.boardName,
      includeCompleted: body.includeCompleted ?? false,
      taskTypes: body.taskTypes,
      assignedTo: body.assignedTo,
      dateRange: body.dateRange ? {
        start: new Date(body.dateRange.start),
        end: new Date(body.dateRange.end)
      } : undefined
    }

    console.log('📋 Export options:', exportOptions)

    // Check Trello credentials
    if (!process.env.TRELLO_API_KEY || !process.env.TRELLO_TOKEN) {
      console.error('❌ Trello credentials not configured')
      return NextResponse.json(
        { error: 'Trello integration not configured. Please contact administrator.' },
        { status: 500 }
      )
    }

    // Get aggregated knowledge data (reuse logic from knowledge/route.ts)
    console.log('📊 Fetching user notes for task aggregation...')
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, analysis, transcription, recorded_at, processed_at')
      .eq('user_id', user.id)
      .not('analysis', 'is', null)
      .order('recorded_at', { ascending: false })

    if (notesError) {
      console.error('❌ Failed to fetch notes:', notesError)
      return NextResponse.json(
        { error: 'Failed to fetch task data' },
        { status: 500 }
      )
    }

    console.log(`📈 Found ${notes?.length || 0} notes with analysis`)

    // Aggregate tasks from notes (using same logic as knowledge API)
    const tasks = aggregateTasksFromNotes(notes || [])
    console.log(`📋 Aggregated ${tasks.length} tasks for export`)

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: 'No tasks found to export. Please process some voice notes first.' },
        { status: 400 }
      )
    }

    // Initialize Trello export service and export tasks
    console.log('🚀 Starting Trello export...')
    const trelloService = new TrelloExportService()
    const result = await trelloService.exportTasks(tasks, exportOptions)

    if (result.success) {
      console.log(`✅ Trello export completed successfully: ${result.boardUrl}`)
      return NextResponse.json({
        success: true,
        message: `Successfully exported ${result.tasksExported} tasks to Trello`,
        result
      })
    } else {
      console.error('❌ Trello export failed:', result.errors)
      return NextResponse.json(
        { 
          error: 'Trello export failed',
          details: result.errors.join(', ')
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('❌ Trello Export API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Aggregate tasks from notes (same logic as knowledge API)
 */
function aggregateTasksFromNotes(notes: any[]): VoiceMemoryTask[] {
  const allTasks: VoiceMemoryTask[] = []

  for (const note of notes) {
    try {
      const analysis = note.analysis
      if (!analysis) continue

      // Process myTasks
      if (analysis.tasks?.myTasks) {
        analysis.tasks.myTasks.forEach((task: string | object, index: number) => {
          // Handle both string and object tasks
          const taskDescription = typeof task === 'string' ? task : (task as any).task || 'Unknown task'
          const taskDetails = typeof task === 'object' ? task as any : null
          
          allTasks.push({
            id: `${note.id}-my-${index}`,
            description: taskDescription,
            type: 'myTasks',
            date: note.recorded_at,
            noteId: note.id,
            noteContext: analysis.keyIdeas?.[0] || note.transcription?.substring(0, 100) || 'No context available',
            nextSteps: taskDetails?.nextSteps,
            assignedTo: taskDetails?.assignedTo
          })
        })
      }

      // Process delegatedTasks
      if (analysis.tasks?.delegatedTasks) {
        analysis.tasks.delegatedTasks.forEach((task: string | object, index: number) => {
          // Handle both string and object tasks
          const taskDescription = typeof task === 'string' ? task : (task as any).task || 'Unknown task'
          const taskDetails = typeof task === 'object' ? task as any : null
          
          allTasks.push({
            id: `${note.id}-delegated-${index}`,
            description: taskDescription,
            type: 'delegatedTasks',
            date: note.recorded_at,
            noteId: note.id,
            noteContext: analysis.keyIdeas?.[0] || note.transcription?.substring(0, 100) || 'No context available',
            nextSteps: taskDetails?.nextSteps,
            assignedTo: taskDetails?.assignedTo
          })
        })
      }
    } catch (noteError) {
      console.error('❌ Error processing note:', note.id, noteError)
      // Continue with next note instead of failing completely
      continue
    }
  }

  // Sort tasks by date (newest first)
  return allTasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// GET endpoint to check Trello integration status
export async function GET(request: NextRequest) {
  try {
    const hasCredentials = !!(process.env.TRELLO_API_KEY && process.env.TRELLO_TOKEN)
    
    return NextResponse.json({
      configured: hasCredentials,
      message: hasCredentials 
        ? 'Trello integration is configured and ready'
        : 'Trello integration requires API key and token configuration'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check Trello configuration' },
      { status: 500 }
    )
  }
}