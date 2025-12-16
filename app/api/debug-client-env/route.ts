import { NextResponse } from 'next/server'

export async function GET() {
  // This endpoint returns environment variables that should be available on the client
  // We'll compare these with what the client actually receives
  
  return NextResponse.json({
    server_side: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
      anonKeyStart: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...',
      anonKeyEnd: '...' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(-20),
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      nodeEnv: process.env.NODE_ENV,
      
      // Validation checks
      validation: {
        urlValid: !!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://'),
        urlPattern: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('.supabase.co'),
        anonKeyValid: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.startsWith('eyJ'),
        anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
        expectedAnonKeyLength: 'should be ~150+ characters for JWT'
      }
    },
    
    // Additional server context
    server_context: {
      platform: process.platform,
      nodeVersion: process.version,
      vercelEnv: process.env.VERCEL_ENV,
      vercelUrl: process.env.VERCEL_URL
    },
    
    timestamp: new Date().toISOString()
  })
}