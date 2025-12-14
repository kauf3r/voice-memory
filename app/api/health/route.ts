import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-server'

// Force dynamic behavior to handle cookies
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Check Supabase connection using service client (no user context needed)
    const supabase = createServiceClient()
    const { error: dbError } = await supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    if (dbError) {
      throw new Error(`Database connection failed: ${dbError.message}`)
    }

    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_KEY',
      'OPENAI_API_KEY'
    ]

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])

    if (missingEnvVars.length > 0) {
      throw new Error(`Missing environment variables: ${missingEnvVars.join(', ')}`)
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      checks: {
        database: 'ok',
        environment: 'ok'
      }
    })

  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        environment: process.env.NODE_ENV
      },
      { status: 503 }
    )
  }
}