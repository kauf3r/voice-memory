import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/supabase-server'
import { uploadAudioFile } from '@/lib/storage'
import { quotaManager } from '@/lib/quota-manager'
import { validateFileUpload, checkUploadRateLimit } from '@/lib/security/file-validation'

export async function POST(request: NextRequest) {
  console.log('Upload API called')
  console.log('ENV CHECK:', {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })

  try {
    // Authenticate the request (handles both Bearer token and cookie auth)
    const { user, error: authError, client: supabase } = await authenticateRequest(request)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Unauthorized - Please log in again' },
        { status: 401 }
      )
    }

    console.log('Authentication successful, proceeding with upload')

    // Parse form data
    console.log('Parsing form data...')
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    console.log('File received:', file ? file.name : 'No file')
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    console.log('Starting comprehensive file validation...')
    console.log('File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    })

    // Rate limiting check
    const rateLimitResult = checkUploadRateLimit(user.id, 10, 60000) // 10 uploads per minute
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          details: rateLimitResult.error,
          remaining: rateLimitResult.remaining,
          resetTime: rateLimitResult.resetTime
        },
        { status: 429 } // Too Many Requests
      )
    }

    // Comprehensive security validation
    const validationResult = await validateFileUpload(file)
    
    if (!validationResult.valid) {
      console.error('File validation failed:', validationResult.errors)
      return NextResponse.json(
        { 
          error: 'File validation failed',
          details: validationResult.errors.join('. '),
          warnings: validationResult.warnings,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        },
        { status: 400 }
      )
    }

    // Log validation warnings if any
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      console.warn('File validation warnings:', validationResult.warnings)
    }

    console.log('File validation passed:', {
      sanitizedFilename: validationResult.sanitizedFilename,
      detectedMimeType: validationResult.detectedMimeType,
      detectedExtension: validationResult.detectedExtension,
      fileHash: validationResult.fileHash
    })

    // Check quota limits using quota manager (temporarily disabled for testing)
    try {
      const quotaCheck = await quotaManager.checkUploadQuota(user.id)
      if (!quotaCheck.allowed) {
        return NextResponse.json(
          { 
            error: 'Quota exceeded',
            details: quotaCheck.reason,
            usage: quotaCheck.usage,
            limits: quotaCheck.limits
          },
          { status: 507 } // Insufficient Storage
        )
      }
    } catch (error) {
      console.warn('Quota check failed, proceeding with upload:', error)
    }

    // Upload to Supabase storage using sanitized filename
    console.log('Starting storage upload for user:', user.id, 'with sanitized filename:', validationResult.sanitizedFilename)
    
    // Create a new File object with sanitized name for storage
    const sanitizedFile = new File([file], validationResult.sanitizedFilename!, {
      type: validationResult.detectedMimeType || file.type,
      lastModified: file.lastModified
    })
    
    const { url, error: uploadError } = await uploadAudioFile(sanitizedFile, user.id, supabase)
    
    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Upload failed', details: uploadError.message },
        { status: 500 }
      )
    }
    
    console.log('Storage upload successful, URL:', url)

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
      // Determine the base URL for internal API calls
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                     process.env.NEXT_PUBLIC_VERCEL_URL || 
                     process.env.VERCEL_URL || 
                     'http://localhost:3000'
      
      const apiUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`
      
      // Make internal API call to process the note using service key
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
        url,
        duration,
        processing: {
          initiated: processResponse.ok,
          status: processResponse.status,
          result: processingResult
        },
        security: {
          originalFilename: file.name,
          sanitizedFilename: validationResult.sanitizedFilename,
          detectedMimeType: validationResult.detectedMimeType,
          fileHash: validationResult.fileHash,
          rateLimitRemaining: rateLimitResult.remaining
        }
      })
    } catch (processingError) {
      console.warn('Failed to initiate auto-processing:', processingError)
      
      // Don't fail the upload if processing fails - just return without processing info
      return NextResponse.json({
        success: true,
        note,
        url,
        duration,
        processing: {
          initiated: false,
          error: processingError instanceof Error ? processingError.message : 'Failed to initiate processing'
        },
        security: {
          originalFilename: file.name,
          sanitizedFilename: validationResult.sanitizedFilename,
          detectedMimeType: validationResult.detectedMimeType,
          fileHash: validationResult.fileHash,
          rateLimitRemaining: rateLimitResult.remaining
        }
      })
    }

  } catch (error) {
    console.error('API error:', error)
    
    // Handle different error types
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Internal server error', 
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}