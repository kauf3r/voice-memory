import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { createDatabaseService } from '@/lib/database/queries'
import { CACHE_CONFIGS, getCachedProcessedContent } from '@/lib/cache/response-cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  console.log('🔍 Tasks API - GET request started')
  
  try {
    // Get user from Authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.split(' ')[1]
    
    // Use centralized authentication helper with SERVICE_KEY
    console.log('🔐 Calling getAuthenticatedUser...')
    const { user, error: authError, client: dbClient } = await getAuthenticatedUser(token)
    
    if (authError || !user || !dbClient) {
      console.error('❌ Authentication failed:', {
        hasUser: !!user,
        hasClient: !!dbClient,
        errorMessage: authError?.message,
        errorDetails: authError
      })
      return NextResponse.json(
        { error: authError?.message || 'Authentication failed' },
        { status: 401 }
      )
    }
    
    console.log('✅ User authenticated:', { userId: user.id, email: user.email })
    
    // Create database service instance with authenticated client
    const dbService = createDatabaseService(dbClient)

    // Parallelize: fetch notes and pinned tasks simultaneously (both only need user.id)
    const [notesResult, pinnedTasksResult] = await Promise.all([
      dbService.getNotesByUser(user.id, {
        hasAnalysis: true,
        orderBy: 'processed_at',
        ascending: false,
        limit: 100
      }),
      dbService.getPinnedTasksByUser(user.id)
    ])

    if (!notesResult.success) {
      console.error('❌ Error fetching notes:', notesResult.error)
      return NextResponse.json(
        { error: notesResult.error || 'Failed to fetch notes' },
        { status: 500 }
      )
    }

    const notes = notesResult.data || []
    const pinnedTasks = pinnedTasksResult.success ? (pinnedTasksResult.data || []) : []
    const pinnedTaskIdSet = new Set(pinnedTasks.map(pin => pin.task_id))

    // Extract tasks from analysis with improved error handling
    const tasks: any[] = []

    if (notes) {
      for (const note of notes) {
        try {
          const analysis = typeof note.analysis === 'string'
            ? JSON.parse(note.analysis)
            : note.analysis

          if (analysis?.tasks && Array.isArray(analysis.tasks)) {
            for (const [index, task] of analysis.tasks.entries()) {
              // Generate consistent task ID format for tracking
              const taskId = `${note.id}-task-${index}`

              tasks.push({
                id: taskId,
                description: task.description || task.task || '',
                type: task.type || 'myTasks',
                date: note.processed_at,
                noteId: note.id,
                completed: false, // Will be updated below
                pinned: pinnedTaskIdSet.has(taskId), // Set pin status immediately
                assignedTo: task.assignedTo,
                nextSteps: task.nextSteps,
                noteContext: task.context,
                priority: task.priority || 'medium'
              })
            }
          }
        } catch (parseError) {
          console.warn('⚠️ Error parsing analysis for note:', note.id, parseError)
        }
      }
    }

    // Fetch task states (needs taskIds from notes processing)
    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id)
      const taskStatesResult = await dbService.getTaskStatesByUser(user.id, taskIds)

      if (!taskStatesResult.success) {
        console.warn('⚠️ Error fetching task states:', taskStatesResult.error)
      } else {
        const taskStates = taskStatesResult.data || []
        // Create state lookup map for O(1) access
        const stateMap = new Map(taskStates.map(s => [s.task_id, s]))

        // Apply task state efficiently
        tasks.forEach(task => {
          const state = stateMap.get(task.id)
          if (state) {
            task.completed = state.completed
            task.completedAt = state.completed_at
          }
        })
      }
    }
    
    const completedCount = tasks.filter(t => t.completed).length
    const pinnedCount = tasks.filter(t => t.pinned).length
    
    console.log('✅ Tasks fetched successfully:', { 
      totalTasks: tasks.length,
      completedTasks: completedCount,
      pinnedTasks: pinnedCount
    })
    
    const response = {
      tasks,
      total: tasks.length,
      completed: completedCount,
      pending: tasks.length - completedCount,
      pinned: pinnedCount,
      maxPins: 10
    }
    
    // Determine last modified date for caching from notes
    const lastModified = notes && notes.length > 0 
      ? Math.max(
          ...notes
            .filter(n => n.processed_at)
            .map(n => new Date(n.processed_at).getTime())
        )
      : Date.now()
    
    // Return cached response with appropriate headers
    return getCachedProcessedContent(
      response,
      new Date(lastModified),
      CACHE_CONFIGS.TASKS,
      request.headers
    )
    
  } catch (error) {
    console.error('❌ Unexpected error in tasks API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}