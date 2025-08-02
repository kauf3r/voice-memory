import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  console.log('🔍 Unified Tasks API - GET request started')
  
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
    
    // Create service client for authentication
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
    
    // Get URL search params for filtering
    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status') // 'all', 'active', 'completed', 'archived'
    const categoryFilter = url.searchParams.get('category') // 'my', 'delegated', 'all'
    const pinnedOnly = url.searchParams.get('pinned') === 'true'
    
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
                assignedTo: task.assignedTo,
                nextSteps: task.nextSteps,
                noteContext: task.context,
                // Default states (will be overridden by task_states data)
                completed: false,
                pinned: false,
                archived: false,
                pinOrder: null,
                completedAt: null,
                completedBy: null,
                completionNotes: null,
                pinnedAt: null,
                archivedAt: null
              })
            })
          }
        } catch (parseError) {
          console.warn('⚠️ Error parsing analysis for note:', note.id, parseError)
        }
      }
    }
    
    // Fetch task states from unified task_states table
    const { data: taskStates, error: statesError } = await supabase
      .from('task_states')
      .select('*')
      .eq('user_id', user.id)
    
    if (statesError) {
      console.warn('⚠️ Error fetching task states:', statesError)
    }
    
    // Apply task states to tasks
    if (taskStates) {
      const statesMap = new Map(taskStates.map(s => [s.task_id, s]))
      
      tasks.forEach(task => {
        const state = statesMap.get(task.id)
        if (state) {
          task.completed = state.completed || false
          task.pinned = state.pinned || false
          task.archived = state.archived || false
          task.pinOrder = state.pin_order
          task.completedAt = state.completed_at
          task.completedBy = state.completed_by
          task.completionNotes = state.completion_notes
          task.pinnedAt = state.pinned_at
          task.archivedAt = state.archived_at
          task.metadata = state.metadata || {}
        }
      })
    }
    
    // Apply filters
    let filteredTasks = tasks
    
    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      switch (statusFilter) {
        case 'active':
          filteredTasks = filteredTasks.filter(t => !t.completed && !t.archived)
          break
        case 'completed':
          filteredTasks = filteredTasks.filter(t => t.completed && !t.archived)
          break
        case 'archived':
          filteredTasks = filteredTasks.filter(t => t.archived)
          break
      }
    }
    
    // Category filter
    if (categoryFilter && categoryFilter !== 'all') {
      switch (categoryFilter) {
        case 'my':
          filteredTasks = filteredTasks.filter(t => t.type === 'myTasks' || !t.type)
          break
        case 'delegated':
          filteredTasks = filteredTasks.filter(t => t.type === 'delegated')
          break
      }
    }
    
    // Pinned filter
    if (pinnedOnly) {
      filteredTasks = filteredTasks.filter(t => t.pinned)
    }
    
    // Sort tasks: pinned first (by pin_order), then by date
    filteredTasks.sort((a, b) => {
      // Pinned tasks first, sorted by pin order
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      if (a.pinned && b.pinned) {
        return (a.pinOrder || 0) - (b.pinOrder || 0)
      }
      
      // Non-pinned tasks sorted by date (newest first)
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
    
    console.log('✅ Unified tasks fetched successfully:', { 
      totalTasks: tasks.length,
      filteredTasks: filteredTasks.length,
      completedTasks: tasks.filter(t => t.completed).length,
      pinnedTasks: tasks.filter(t => t.pinned).length,
      archivedTasks: tasks.filter(t => t.archived).length
    })
    
    return NextResponse.json({
      tasks: filteredTasks,
      total: tasks.length,
      filtered: filteredTasks.length,
      stats: {
        completed: tasks.filter(t => t.completed && !t.archived).length,
        pending: tasks.filter(t => !t.completed && !t.archived).length,
        pinned: tasks.filter(t => t.pinned && !t.archived).length,
        archived: tasks.filter(t => t.archived).length,
        active: tasks.filter(t => !t.archived).length
      }
    })
    
  } catch (error) {
    console.error('❌ Unexpected error in unified tasks API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}