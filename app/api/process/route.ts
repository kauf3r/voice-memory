import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { transcribeAudio, analyzeTranscription } from '@/lib/openai'
import { quotaManager } from '@/lib/quota-manager'

export async function POST(request: NextRequest) {
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
      const { data: { user: cookieUser }, error } = await supabase.auth.getUser()
      user = cookieUser
      authError = error
    }
    
    // Check for service key authentication (for admin operations)
    const serviceAuthHeader = request.headers.get('X-Service-Auth')
    const isServiceAuth = serviceAuthHeader === 'true' && 
                         authHeader?.includes(process.env.SUPABASE_SERVICE_KEY || '')
    
    if (!user && !isServiceAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { noteId, forceReprocess = false } = body

    if (!noteId) {
      return NextResponse.json(
        { error: 'noteId is required' },
        { status: 400 }
      )
    }

    // Get the note
    let noteQuery = supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
    
    // If we have a user, filter by user_id. If service auth, don't filter by user.
    if (user && !isServiceAuth) {
      noteQuery = noteQuery.eq('user_id', user.id)
    }
    
    const { data: note, error: fetchError } = await noteQuery.single()

    if (fetchError) {
      console.error('Note fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      )
    }

    // Check if already processed
    if (note.processed_at && !forceReprocess) {
      return NextResponse.json({
        success: true,
        note,
        message: 'Note already processed'
      })
    }

    // Check processing quota (skip for service auth)
    if (user && !isServiceAuth) {
      const quotaCheck = await quotaManager.checkProcessingQuota(user.id)
      if (!quotaCheck.allowed) {
        return NextResponse.json(
          { 
            error: 'Processing quota exceeded',
            details: quotaCheck.reason,
            usage: quotaCheck.usage,
            limits: quotaCheck.limits
          },
          { status: 429 } // Too Many Requests
        )
      }

      // Record processing attempt
      await quotaManager.recordProcessingAttempt(user.id)
    }

    // Get audio file from storage
    const { data: audioData, error: storageError } = await supabase.storage
      .from('audio-files')
      .download(getFilePathFromUrl(note.audio_url))

    if (storageError || !audioData) {
      console.error('Storage error:', storageError)
      return NextResponse.json(
        { error: 'Could not retrieve audio file' },
        { status: 500 }
      )
    }

    // Convert blob to File object for Whisper API
    const audioFile = new File([audioData], 'audio.mp3', { type: 'audio/mpeg' })

    // Step 1: Transcribe audio
    console.log('Starting transcription for note:', noteId)
    const { text: transcription, error: transcriptionError } = await transcribeAudio(audioFile)

    if (transcriptionError || !transcription) {
      console.error('Transcription failed:', transcriptionError)
      
      // Update note with error status
      await supabase
        .from('notes')
        .update({
          processed_at: new Date().toISOString(),
          // Could add an error field to track failures
        })
        .eq('id', noteId)

      return NextResponse.json(
        { error: transcriptionError?.message || 'Transcription failed' },
        { status: 500 }
      )
    }

    // Step 2: Get project knowledge for context
    const userId = user?.id || note.user_id // Use note's user_id if service auth
    const { data: projectKnowledge } = await supabase
      .from('project_knowledge')
      .select('content')
      .eq('user_id', userId)
      .single()

    const knowledgeContext = projectKnowledge?.content ? 
      JSON.stringify(projectKnowledge.content) : 
      ''

    // Step 3: Analyze transcription
    console.log('Starting analysis for note:', noteId)
    const { analysis, error: analysisError } = await analyzeTranscription(
      transcription, 
      knowledgeContext
    )

    if (analysisError) {
      console.error('Analysis failed:', analysisError)
      
      // Update note with transcription but no analysis
      const { data: updatedNote } = await supabase
        .from('notes')
        .update({
          transcription,
          processed_at: new Date().toISOString(),
        })
        .eq('id', noteId)
        .select()
        .single()

      return NextResponse.json({
        success: false,
        note: updatedNote,
        error: analysisError.message,
        message: 'Transcription completed but analysis failed'
      })
    }

    // Step 4: Update note with results
    const { data: updatedNote, error: updateError } = await supabase
      .from('notes')
      .update({
        transcription,
        analysis,
        processed_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to save processing results' },
        { status: 500 }
      )
    }

    // Step 5: Update project knowledge (optional)
    if (analysis?.crossReferences?.projectKnowledgeUpdates?.length > 0) {
      try {
        const currentKnowledge = projectKnowledge?.content || {}
        const updates = analysis.crossReferences.projectKnowledgeUpdates
        
        // Simple knowledge update - in production, this would be more sophisticated
        const newKnowledge = {
          ...currentKnowledge,
          lastUpdated: new Date().toISOString(),
          recentInsights: [
            ...(currentKnowledge.recentInsights || []),
            ...updates
          ].slice(-50) // Keep last 50 insights
        }

        await supabase
          .from('project_knowledge')
          .upsert({
            user_id: userId,
            content: newKnowledge,
            updated_at: new Date().toISOString(),
          })
      } catch (knowledgeError) {
        console.warn('Failed to update project knowledge:', knowledgeError)
        // Don't fail the whole process for this
      }
    }

    console.log('Processing completed successfully for note:', noteId)

    return NextResponse.json({
      success: true,
      note: updatedNote,
      message: 'Processing completed successfully'
    })

  } catch (error) {
    console.error('Processing error:', error)
    return NextResponse.json(
      { error: 'Internal server error during processing' },
      { status: 500 }
    )
  }
}

// Batch processing endpoint
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get unprocessed notes
    const { data: unprocessedNotes, error: fetchError } = await supabase
      .from('notes')
      .select('id')
      .eq('user_id', user.id)
      .is('processed_at', null)
      .limit(5) // Process up to 5 notes at a time

    if (fetchError) {
      console.error('Fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch unprocessed notes' },
        { status: 500 }
      )
    }

    if (!unprocessedNotes || unprocessedNotes.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No notes to process'
      })
    }

    console.log(`Starting batch processing of ${unprocessedNotes.length} notes`)

    // Process notes sequentially to avoid rate limiting
    const results = []
    for (const note of unprocessedNotes) {
      try {
        // Call the single note processing
        const processResponse = await fetch(`${request.nextUrl.origin}/api/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Forward auth headers
            'Authorization': request.headers.get('Authorization') || '',
            'Cookie': request.headers.get('Cookie') || '',
          },
          body: JSON.stringify({ noteId: note.id })
        })

        const result = await processResponse.json()
        results.push({
          noteId: note.id,
          success: result.success,
          error: result.error
        })

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`Failed to process note ${note.id}:`, error)
        results.push({
          noteId: note.id,
          success: false,
          error: 'Processing failed'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      processed: successCount,
      failed: failureCount,
      results,
      message: `Batch processing completed: ${successCount} successful, ${failureCount} failed`
    })

  } catch (error) {
    console.error('Batch processing error:', error)
    return NextResponse.json(
      { error: 'Batch processing failed' },
      { status: 500 }
    )
  }
}

// Helper function to extract file path from Supabase storage URL
function getFilePathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    const bucketIndex = pathParts.indexOf('audio-files')
    if (bucketIndex === -1) return ''
    
    return pathParts.slice(bucketIndex + 1).join('/')
  } catch (error) {
    console.error('Error extracting file path from URL:', url, error)
    return ''
  }
}