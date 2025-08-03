import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { createDatabaseService } from '@/lib/database/queries'

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
    
    // Fetch notes with analysis using abstracted database layer
    const notesResult = await dbService.getNotesByUser(user.id, {
      hasAnalysis: true,
      orderBy: 'processed_at',
      ascending: false,
      limit: 100
    })
    
    if (!notesResult.success) {
      console.error('❌ Error fetching notes:', notesResult.error)
      return NextResponse.json(
        { error: notesResult.error || 'Failed to fetch notes' },
        { status: 500 }
      )
    }
    
    const notes = notesResult.data || []
    
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
    
    // Fetch task states using abstracted database layer
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
    
    // Get pin status for tasks using abstracted database layer
    let pinnedTaskIds: string[] = []
    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id)
      const pinnedTasksResult = await dbService.getPinnedTasksByUser(user.id)
      
      if (pinnedTasksResult.success) {
        const pinnedTasks = pinnedTasksResult.data || []
        // Filter to only include tasks that are in our current task list
        pinnedTaskIds = pinnedTasks
          .filter(pin => taskIds.includes(pin.task_id))
          .map(pin => pin.task_id)
      }
    }
    
    // Add pin status to tasks
    tasks.forEach(task => {
      task.pinned = pinnedTaskIds.includes(task.id)
    })
    
    const completedCount = tasks.filter(t => t.completed).length
    const pinnedCount = tasks.filter(t => t.pinned).length
    
    console.log('✅ Tasks fetched successfully:', { 
      totalTasks: tasks.length,
      completedTasks: completedCount,
      pinnedTasks: pinnedCount
    })
    
    return NextResponse.json({
      tasks,
      total: tasks.length,
      completed: completedCount,
      pending: tasks.length - completedCount,
      pinned: pinnedCount,
      maxPins: 10
    })
    
  } catch (error) {
    console.error('❌ Unexpected error in tasks API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}