import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Security: Disable debug endpoints in production
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 })
  }
  
  console.log('🔍 Debug Auth Production - GET request started')
  
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
        serviceKeyPresent: !!process.env.SUPABASE_SERVICE_KEY
      },
      authHeader: {
        present: !!authHeader,
        startsWithBearer: authHeader?.startsWith('Bearer '),
        length: authHeader?.length || 0,
        tokenPreview: authHeader ? authHeader.substring(0, 30) + '...' : 'not present'
      }
    }

    console.log('🐛 Debug info:', debugInfo)

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Missing or invalid authorization header',
        debugInfo
      })
    }

    const token = authHeader.split(' ')[1]

    // Try both authentication methods
    let serviceAuthResult = null
    let anonAuthResult = null

    // Test service key authentication if available
    if (process.env.SUPABASE_SERVICE_KEY) {
      try {
        const serviceClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_KEY
        )
        
        const { data: { user }, error } = await serviceClient.auth.getUser(token)
        serviceAuthResult = {
          success: !error,
          error: error?.message || null,
          userId: user?.id || null,
          userEmail: user?.email || null
        }
      } catch (err) {
        serviceAuthResult = {
          success: false,
          error: `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`,
          userId: null,
          userEmail: null
        }
      }
    }

    // Test anon key authentication
    try {
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      )
      
      const { data: { user }, error } = await anonClient.auth.getUser()
      anonAuthResult = {
        success: !error,
        error: error?.message || null,
        userId: user?.id || null,
        userEmail: user?.email || null
      }
    } catch (err) {
      anonAuthResult = {
        success: false,
        error: `Exception: ${err instanceof Error ? err.message : 'Unknown error'}`,
        userId: null,
        userEmail: null
      }
    }

    return NextResponse.json({
      success: true,
      debugInfo,
      authenticationTests: {
        serviceAuth: serviceAuthResult,
        anonAuth: anonAuthResult
      },
      recommendation: serviceAuthResult?.success 
        ? 'Use service key authentication'
        : anonAuthResult?.success 
          ? 'Use anon key authentication'
          : 'Both authentication methods failed'
    })

  } catch (error) {
    console.error('Debug auth production error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}