import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    
    // Create service client for authentication - fallback to anon key if service key not available
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.log('❌ Invalid token or user not found:', authError?.message)
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }
    
    console.log('✅ User authenticated:', { userId: user.id, email: user.email })
    
    // Fetch tasks from notes where analysis contains tasks
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, user_id, analysis, processed_at')
      .eq('user_id', user.id)
      .not('analysis', 'is', null)
      .order('processed_at', { ascending: false })
    
    if (notesError) {
      console.error('❌ Error fetching notes:', notesError)
      return NextResponse.json(
        { error: 'Failed to fetch notes' },
        { status: 500 }
      )
    }
    
    // Extract tasks from analysis
    const tasks: any[] = []
    
    if (notes) {
      for (const note of notes) {
        try {
          const analysis = typeof note.analysis === 'string' 
            ? JSON.parse(note.analysis) 
            : note.analysis
          
          if (analysis?.tasks && Array.isArray(analysis.tasks)) {
            analysis.tasks.forEach((task: any, index: number) => {
              // Generate consistent, deterministic task ID
              const taskContent = task.description || task.task || ''
              const contentHash = Buffer.from(taskContent.slice(0, 50)).toString('base64')
                .replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
              const taskId = `${note.id}-task-${index}-${contentHash}`
              
              tasks.push({
                id: taskId,
                description: taskContent,
                type: task.type || 'myTasks',
                date: note.processed_at,
                noteId: note.id,
                completed: false,
                assignedTo: task.assignedTo,
                nextSteps: task.nextSteps,
                noteContext: task.context
              })
            })
          }
        } catch (parseError) {
          console.warn('⚠️ Error parsing analysis for note:', note.id, parseError)
        }
      }
    }
    
    // Fetch task completions
    const { data: completions, error: completionsError } = await supabase
      .from('task_completions')
      .select('task_id, completed_at, completed_by, notes')
      .eq('user_id', user.id)
    
    if (completionsError) {
      console.warn('⚠️ Error fetching task completions:', completionsError)
    }
    
    // Apply completion status
    if (completions) {
      const completionMap = new Map(completions.map(c => [c.task_id, c]))
      
      tasks.forEach(task => {
        const completion = completionMap.get(task.id)
        if (completion) {
          task.completed = true // If record exists, task is completed
          task.completedAt = completion.completed_at
          task.completedBy = completion.completed_by
          task.completionNotes = completion.notes
        }
      })
    }
    
    console.log('✅ Tasks fetched successfully:', { 
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.completed).length
    })
    
    return NextResponse.json({
      tasks,
      total: tasks.length,
      completed: tasks.filter(t => t.completed).length,
      pending: tasks.filter(t => !t.completed).length
    })
    
  } catch (error) {
    console.error('❌ Unexpected error in tasks API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}