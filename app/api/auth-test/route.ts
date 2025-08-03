import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    console.log('Auth test - header:', authHeader ? 'Present' : 'Missing')
    
    // Debug cookies
    const cookieHeader = request.headers.get('cookie') || ''
    const cookies = cookieHeader.split(';').map(c => c.trim())
    const supabaseCookies = cookies.filter(c => c.includes('sb-'))
    const allCookieNames = cookies.map(c => c.split('=')[0])
    console.log('All cookies:', allCookieNames)
    console.log('Supabase cookies found:', supabaseCookies.length)
    console.log('Cookie names:', supabaseCookies.map(c => c.split('=')[0]))
    
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    return NextResponse.json({
      authHeader: !!authHeader,
      user: user ? { id: user.id, email: user.email } : null,
      error: error?.message || null,
      cookies: request.headers.get('cookie') ? 'Present' : 'Missing',
      supabaseCookies: supabaseCookies.map(c => c.split('=')[0])
    })
  } catch (error) {
    return NextResponse.json({ 
      error: 'Server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}