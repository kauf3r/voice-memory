import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { uploadAudioFile } from '@/lib/storage'

export async function POST(request: NextRequest) {
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3', 
      'audio/wav',
      'audio/m4a',
      'audio/aac',
      'audio/ogg',
      'audio/webm'
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} not supported` },
        { status: 400 }
      )
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' },
        { status: 400 }
      )
    }

    // Upload to Supabase storage
    const { url, error: uploadError } = await uploadAudioFile(file, user.id)
    
    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Upload failed' },
        { status: 500 }
      )
    }

    // Get audio duration (basic implementation)
    let duration: number | null = null
    try {
      // Note: In a real implementation, you'd want to use a library like ffprobe
      // or extract duration metadata. For now, we'll estimate based on file size
      duration = Math.round(file.size / (128 * 1024 / 8)) // Estimate for 128kbps
    } catch (error) {
      console.warn('Could not determine audio duration:', error)
    }

    // Create note record in database
    const { data: note, error: dbError } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        audio_url: url,
        duration_seconds: duration,
        recorded_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create note record' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      note,
      url,
      duration
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}