import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, getAuthenticatedUser } from '@/lib/supabase-server'
import { processingService } from '@/lib/processing/ProcessingService'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

async function getUser(request: NextRequest) {
  // Try Bearer token auth first
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { user, client, error } = await getAuthenticatedUser(token)
    if (user && client) {
      return { user, supabase: client }
    }
  }

  // Fall back to cookie auth
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (user) {
    return { user, supabase }
  }

  return { user: null, supabase: null }
}

// GET: Check how many notes need V2 migration
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getUser(request)

    if (!user || !supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find notes that have analysis but no openLoops field
    // These were processed with V1 and need V2 reprocessing
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, processed_at, analysis')
      .eq('user_id', user.id)
      .not('processed_at', 'is', null)
      .not('analysis', 'is', null)

    if (error) {
      console.error('Error fetching notes:', error)
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
    }

    // Filter to notes missing openLoops in their analysis
    const needsMigration = notes.filter(note => {
      if (!note.analysis) return false
      const analysis = typeof note.analysis === 'string'
        ? JSON.parse(note.analysis)
        : note.analysis
      return !analysis.openLoops
    })

    return NextResponse.json({
      total: notes.length,
      needsMigration: needsMigration.length,
      alreadyV2: notes.length - needsMigration.length,
      noteIds: needsMigration.map(n => n.id)
    })

  } catch (error) {
    console.error('Migration check error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST: Start V2 migration for notes missing openLoops
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getUser(request)

    if (!user || !supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const batchSize = Math.min(body.batchSize || 5, 10) // Max 10 at a time

    // Find notes needing migration
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, analysis')
      .eq('user_id', user.id)
      .not('processed_at', 'is', null)
      .not('analysis', 'is', null)
      .order('processed_at', { ascending: true }) // Oldest first

    if (error) {
      console.error('Error fetching notes:', error)
      return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
    }

    // Filter to notes missing openLoops
    const needsMigration = notes.filter(note => {
      if (!note.analysis) return false
      const analysis = typeof note.analysis === 'string'
        ? JSON.parse(note.analysis)
        : note.analysis
      return !analysis.openLoops
    })

    if (needsMigration.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All notes already have V2 analysis',
        processed: 0,
        remaining: 0
      })
    }

    // Process batch
    const batch = needsMigration.slice(0, batchSize)
    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[]
    }

    console.log(`🔄 Starting V2 migration for ${batch.length} notes (${needsMigration.length} total need migration)`)

    for (const note of batch) {
      try {
        console.log(`📝 Reprocessing note ${note.id} with V2 analysis...`)
        const result = await processingService.processNote(note.id, user.id, true) // forceReprocess = true

        if (result.success) {
          results.processed++
          console.log(`✅ Successfully migrated note ${note.id}`)
        } else {
          results.failed++
          results.errors.push(`${note.id}: ${result.error}`)
          console.error(`❌ Failed to migrate note ${note.id}:`, result.error)
        }
      } catch (err) {
        results.failed++
        const errorMsg = err instanceof Error ? err.message : String(err)
        results.errors.push(`${note.id}: ${errorMsg}`)
        console.error(`❌ Error migrating note ${note.id}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migrated ${results.processed} notes to V2 analysis`,
      processed: results.processed,
      failed: results.failed,
      remaining: needsMigration.length - batch.length,
      errors: results.errors.length > 0 ? results.errors : undefined
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
