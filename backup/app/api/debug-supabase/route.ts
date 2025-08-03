import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    // Test with service key directly
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_KEY!
    
    console.log('Testing Supabase connection...')
    console.log('URL:', supabaseUrl?.substring(0, 30) + '...')
    console.log('Service key length:', serviceKey?.length)
    
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Simple test query
    const { data, error } = await supabase
      .from('notes')
      .select('id')
      .limit(1)
    
    return NextResponse.json({
      success: !error,
      error: error ? {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      } : null,
      dataCount: data?.length || 0,
      supabaseUrl: supabaseUrl?.substring(0, 30) + '...',
      serviceKeyLength: serviceKey?.length,
      serviceKeyStart: serviceKey?.substring(0, 20) + '...'
    })
    
  } catch (err) {
    console.error('Supabase test error:', err)
    return NextResponse.json({
      success: false,
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        type: typeof err,
        stack: err instanceof Error ? err.stack?.substring(0, 500) : null
      }
    })
  }
}