import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { processingService } from '@/lib/processing/ProcessingService'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get auth token from header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    let user = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data, error } = await supabase.auth.getUser(token)
      
      if (!error && data?.user) {
        user = data.user
        await supabase.auth.setSession({
          access_token: token,
          refresh_token: token
        })
      }
    }
    
    // If no auth header, try cookies
    if (!user) {
      const { data: { user: cookieUser } } = await supabase.auth.getUser()
      user = cookieUser
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

    const body = await request.json().catch(() => ({}))
    const { forceReset = false } = body

    console.log(`Resetting stuck processing jobs... (forceReset: ${forceReset})`)
    const result = await processingService.resetStuckProcessing(forceReset)

    return NextResponse.json({
      success: true,
      message: `Reset ${result.reset} stuck processing jobs`,
      reset: result.reset,
      forceReset
    })

  } catch (error) {
    console.error('Reset processing API error:', error)
    return NextResponse.json(
      { error: 'Failed to reset stuck processing' },
      { status: 500 }
    )
  }
}