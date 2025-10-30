import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { AuthDebugger } from '@/lib/auth-debug'

export async function GET(request: NextRequest) {
  console.log('🔗 Auth callback route called')
  AuthDebugger.log('Auth callback route called')
  
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const next = searchParams.get('next') ?? '/'
  
  console.log('🔍 Auth callback debug:', {
    hasCode: !!code,
    hasError: !!error,
    error: error,
    errorDescription: errorDescription,
    origin: origin,
    url: request.url,
    userAgent: request.headers.get('user-agent')?.substring(0, 100)
  })

  // Handle auth errors
  if (error) {
    console.error('❌ Auth callback error:', error, errorDescription)
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, origin))
  }

  // Handle PKCE flow
  if (code) {
    console.log('🔐 Processing PKCE auth code:', code.substring(0, 10) + '...')
    
    try {
      const supabase = await createServerSupabaseClient()
      console.log('🔗 Supabase client created for code exchange')
      
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('❌ Code exchange failed:', {
          error: exchangeError.message,
          status: exchangeError.status || 'unknown',
          details: exchangeError
        })
        
        // Create more specific error messages
        let errorMessage = 'code_exchange_failed'
        if (exchangeError.message?.includes('Invalid login credentials')) {
          errorMessage = 'invalid_credentials'
        } else if (exchangeError.message?.includes('expired')) {
          errorMessage = 'expired_link'
        } else if (exchangeError.message?.includes('already_used')) {
          errorMessage = 'link_already_used'
        }
        
        return NextResponse.redirect(new URL(`/?error=${errorMessage}&details=${encodeURIComponent(exchangeError.message)}`, origin))
      }
      
      if (data?.session) {
        console.log('✅ PKCE auth successful, user:', data.session.user.id)
        console.log('📧 User email:', data.session.user.email)
        
        // Create response with proper headers
        const response = NextResponse.redirect(new URL(next, origin))
        
        // Add cache control headers to prevent caching of auth callback
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        
        return response
      } else {
        console.error('❌ No session returned from code exchange')
        return NextResponse.redirect(new URL(`/?error=no_session_returned`, origin))
      }
    } catch (error) {
      console.error('❌ Auth callback exception:', error)
      AuthDebugger.error('Auth callback exception:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.redirect(new URL(`/?error=callback_exception&details=${encodeURIComponent(errorMessage)}`, origin))
    }
  }

  // For implicit flow or direct redirects, just redirect to home
  // The AuthProvider will handle token processing from URL hash
  AuthDebugger.log('Redirecting to home page for client-side auth processing')
  return NextResponse.redirect(new URL('/', origin))
}