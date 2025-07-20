import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET() {
  let supabaseTest = 'not_tested'
  
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase.from('notes').select('count').limit(1)
    
    if (error) {
      supabaseTest = `error: ${error.message}`
    } else {
      supabaseTest = 'success'
    }
  } catch (err) {
    supabaseTest = `exception: ${err instanceof Error ? err.message : 'unknown'}`
  }

  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    anonKeyStart: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...',
    anonKeyEnd: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(-20) + '...',
    anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    supabaseTest: supabaseTest
  })
}