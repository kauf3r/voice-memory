import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'

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
    
    // Optimized query: Fetch tasks from voice_notes where analysis contains tasks
    // Using proper Supabase query optimization
    const { data: notes, error: notesError } = await dbClient
      .from('voice_notes')
      .select('id, user_id, analysis, processed_at')
      .eq('user_id', user.id)
      .not('analysis', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(100) // Add reasonable limit for performance
    
    if (notesError) {
      console.error('❌ Error fetching notes:', notesError)
      return NextResponse.json(
        { error: 'Failed to fetch notes' },
        { status: 500 }
      )
    }
    
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
    
    // Optimized completion status query using single batch request
    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id)
      const { data: completions, error: completionsError } = await dbClient
        .from('task_completions')
        .select('task_id, completed_at, completed_by')
        .eq('user_id', user.id)
        .in('task_id', taskIds)
      
      if (completionsError) {
        console.warn('⚠️ Error fetching task completions:', completionsError)
      } else if (completions) {
        // Create completion lookup map for O(1) access
        const completionMap = new Map(completions.map(c => [c.task_id, c]))
        
        // Apply completion status efficiently
        tasks.forEach(task => {
          const completion = completionMap.get(task.id)
          if (completion) {
            task.completed = true
            task.completedAt = completion.completed_at
            task.completedBy = completion.completed_by
          }
        })
      }
    }
    
    // Get pin status for tasks in a single query
    let pinnedTaskIds: string[] = []
    if (tasks.length > 0) {
      const taskIds = tasks.map(t => t.id)
      const { data: pins, error: pinsError } = await dbClient
        .from('task_pins')
        .select('task_id')
        .eq('user_id', user.id)
        .in('task_id', taskIds)
      
      if (!pinsError && pins) {
        pinnedTaskIds = pins.map(p => p.task_id)
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