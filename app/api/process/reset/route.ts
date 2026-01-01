import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/supabase-server'
import { processingService } from '@/lib/processing/ProcessingService'

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request (handles both Bearer token and cookie auth)
    const { user, error: authError } = await authenticateRequest(request)

    // Check for service key authentication (for admin operations)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
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
