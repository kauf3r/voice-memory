import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { processingService } from '@/lib/processing-service'

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
    const { batchSize = 5 } = body

    if (batchSize > 10) {
      return NextResponse.json(
        { error: 'Batch size cannot exceed 10' },
        { status: 400 }
      )
    }

    const userId = user?.id || 'service-admin'
    console.log(`Starting batch processing for user ${userId} with batch size ${batchSize}`)

    const result = await processingService.processNextBatch(batchSize)

    return NextResponse.json({
      success: true,
      ...result,
      message: `Batch processing completed: ${result.processed} successful, ${result.failed} failed`
    })

  } catch (error) {
    console.error('Batch processing API error:', error)
    return NextResponse.json(
      { error: 'Batch processing failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const stats = await processingService.getProcessingStats(user.id)

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Processing stats API error:', error)
    return NextResponse.json(
      { error: 'Failed to get processing stats' },
      { status: 500 }
    )
  }
}