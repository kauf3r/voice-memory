import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { AuthDebugger } from '@/lib/auth-debug'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
  AuthDebugger.log('Auth callback route called')
  
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Handle auth errors
  if (error) {
    console.error('❌ Auth callback error:', error, errorDescription)
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, request.url))
  }

  // Handle PKCE flow
  if (code) {
    console.log('🔐 Processing PKCE auth code...')
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('❌ Code exchange failed:', exchangeError)
        return NextResponse.redirect(new URL(`/?error=code_exchange_failed`, request.url))
      }
      
      if (data?.session) {
        console.log('✅ PKCE auth successful for user:', data.session.user.id)
        
        // Set auth cookies for the session
        const response = NextResponse.redirect(new URL('/', request.url))
        
        // Set session cookies (optional - client will handle this via AuthProvider)
        response.cookies.set('supabase-auth-token', data.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        })
        
        return response
      }
    } catch (error) {
      AuthDebugger.error('Auth callback exception:', error)
      return NextResponse.redirect(new URL(`/?error=callback_exception`, request.url))
    }
  }

  // For implicit flow or direct redirects, just redirect to home
  // The AuthProvider will handle token processing from URL hash
  AuthDebugger.log('Redirecting to home page for client-side auth processing')
  return NextResponse.redirect(new URL('/', request.url))
}