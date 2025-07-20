import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    anonKeyStart: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...',
    anonKeyEnd: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(-20) + '...',
    anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    appUrl: process.env.NEXT_PUBLIC_APP_URL
  })
}