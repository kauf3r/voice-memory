import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/upload/create-note
 *
 * Creates a note record after a direct-to-storage upload.
 * This is the second step of the signed URL upload flow.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const { user, error: authError, client: supabase } = await authenticateRequest(request)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Unauthorized - Please log in again' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { audioUrl, filePath, fileSize } = body

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'audioUrl is required' },
        { status: 400 }
      )
    }

    console.log('Creating note record for direct upload:', { audioUrl, filePath, fileSize })

    // Estimate duration based on file size (rough estimate for 128kbps)
    const durationEstimate = fileSize ? Math.round(fileSize / (128 * 1024 / 8)) : null

    // Create note record in database
    const { data: note, error: dbError } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        audio_url: audioUrl,
        duration_seconds: durationEstimate,
        recorded_at: new Date().toISOString(),
      })
      .select('id, user_id, audio_url, duration_seconds, recorded_at, processed_at, created_at')
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create note record', details: dbError.message },
        { status: 500 }
      )
    }

    // Auto-trigger processing for newly uploaded notes
    console.log('Triggering automatic processing for note:', note.id)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                     process.env.NEXT_PUBLIC_VERCEL_URL ||
                     process.env.VERCEL_URL ||
                     'http://localhost:3000'

      const apiUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`

      const serviceKey = process.env.SUPABASE_SERVICE_KEY
      const processResponse = await fetch(`${apiUrl}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'X-Service-Auth': 'true'
        },
        body: JSON.stringify({
          noteId: note.id,
          forceReprocess: false
        })
      })

      let processingResult = null
      if (processResponse.ok) {
        processingResult = await processResponse.json()
        console.log('Auto-processing initiated successfully')
      } else {
        console.warn('Auto-processing failed:', processResponse.status, processResponse.statusText)
      }

      return NextResponse.json({
        success: true,
        note,
        processing: {
          initiated: processResponse.ok,
          status: processResponse.status,
          result: processingResult
        }
      })
    } catch (processingError) {
      console.warn('Failed to initiate auto-processing:', processingError)

      // Don't fail if processing fails - just return the note
      return NextResponse.json({
        success: true,
        note,
        processing: {
          initiated: false,
          error: processingError instanceof Error ? processingError.message : 'Failed to initiate processing'
        }
      })
    }

  } catch (error) {
    console.error('Create note API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
