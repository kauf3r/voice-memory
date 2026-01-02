import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/upload/signed-url
 *
 * Returns a signed upload URL for direct upload to Supabase Storage.
 * This bypasses Vercel's body size limit (4.5MB) by uploading directly.
 */
export async function GET(request: NextRequest) {
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

    // Get filename from query params (optional, for extension detection)
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename') || 'recording'

    // Determine file extension
    const ext = filename.includes('.')
      ? filename.split('.').pop()?.toLowerCase() || 'mp3'
      : 'mp3'

    // Generate unique file path
    const timestamp = Date.now()
    const filePath = `${user.id}/${timestamp}.${ext}`

    console.log('Creating signed upload URL for:', filePath)

    // Create signed upload URL (valid for 5 minutes)
    const { data, error } = await supabase.storage
      .from('audio-files')
      .createSignedUploadUrl(filePath)

    if (error) {
      console.error('Failed to create signed URL:', error)
      return NextResponse.json(
        { error: 'Failed to create upload URL', details: error.message },
        { status: 500 }
      )
    }

    // Get the public URL for after upload
    const { data: publicUrlData } = supabase.storage
      .from('audio-files')
      .getPublicUrl(filePath)

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      filePath: filePath,
      publicUrl: publicUrlData.publicUrl
    })

  } catch (error) {
    console.error('Signed URL generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}
