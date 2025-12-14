import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'
import { uploadAudioFile } from '@/lib/storage'

// Simple API key upload endpoint for iOS Shortcuts
// Uses a static API key from environment variable

const SHORTCUT_API_KEY = process.env.SHORTCUT_API_KEY

export async function POST(request: NextRequest) {
  console.log('Shortcut upload API called')

  // Check API key is configured
  if (!SHORTCUT_API_KEY) {
    console.error('SHORTCUT_API_KEY not configured')
    return NextResponse.json(
      { error: 'Shortcut uploads not configured' },
      { status: 500 }
    )
  }

  // Validate API key from header
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key')

  if (!apiKey || apiKey !== SHORTCUT_API_KEY) {
    console.error('Invalid or missing API key')
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    )
  }

  try {
    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    console.log('File received:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`)

    // Basic validation
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 25MB.` },
        { status: 413 }
      )
    }

    // Get the shortcut user ID from env (or use a default for single-user setup)
    const userId = process.env.SHORTCUT_USER_ID

    if (!userId) {
      console.error('SHORTCUT_USER_ID not configured')
      return NextResponse.json(
        { error: 'Shortcut user not configured' },
        { status: 500 }
      )
    }

    // Use service client to bypass RLS
    const supabase = createServiceClient()

    // Generate a clean filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const extension = file.name.split('.').pop() || 'm4a'
    const sanitizedFilename = `shortcut-${timestamp}.${extension}`

    // Create sanitized file
    const sanitizedFile = new File([file], sanitizedFilename, {
      type: file.type || 'audio/m4a',
      lastModified: file.lastModified
    })

    // Upload to storage
    console.log('Uploading to storage...')
    const { url, error: uploadError } = await uploadAudioFile(sanitizedFile, userId, supabase)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Upload failed', details: uploadError.message },
        { status: 500 }
      )
    }

    console.log('Upload successful:', url)

    // Estimate duration
    const duration = Math.round(file.size / (128 * 1024 / 8))

    // Create note record
    const { data: note, error: dbError } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        audio_url: url,
        duration_seconds: duration,
        recorded_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create note', details: dbError.message },
        { status: 500 }
      )
    }

    // Trigger processing
    console.log('Triggering processing for note:', note.id)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                     process.env.VERCEL_URL ||
                     'http://localhost:3000'

      const apiUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`

      // Use service-level auth for processing
      await fetch(`${apiUrl}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Auth': process.env.SUPABASE_SERVICE_KEY || ''
        },
        body: JSON.stringify({
          noteId: note.id,
          forceReprocess: false
        })
      })
    } catch (processError) {
      console.warn('Processing trigger failed:', processError)
      // Don't fail the upload if processing fails
    }

    return NextResponse.json({
      success: true,
      message: 'Voice note uploaded successfully',
      noteId: note.id,
      filename: sanitizedFilename
    })

  } catch (error) {
    console.error('Shortcut upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
