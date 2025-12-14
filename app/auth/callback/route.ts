import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  console.log('Auth callback route called')
  
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
        let helpMessage = exchangeError.message

        if (exchangeError.message?.includes('Invalid login credentials')) {
          errorMessage = 'invalid_credentials'
        } else if (exchangeError.message?.includes('expired')) {
          errorMessage = 'expired_link'
          helpMessage = 'This magic link has expired. Please request a new one.'
        } else if (exchangeError.message?.includes('already_used')) {
          errorMessage = 'link_already_used'
          helpMessage = 'This magic link has already been used. Please request a new one.'
        } else if (exchangeError.message?.includes('code verifier')) {
          errorMessage = 'browser_mismatch'
          helpMessage = 'Please open this magic link in the same browser where you requested it. If that doesn\'t work, request a new magic link and click it immediately in the same browser.'
        }

        return NextResponse.redirect(new URL(`/?error=${errorMessage}&details=${encodeURIComponent(helpMessage)}`, origin))
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
      console.error('Auth callback exception:', error)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.redirect(new URL(`/?error=callback_exception&details=${encodeURIComponent(errorMessage)}`, origin))
    }
  }

  // For implicit flow or direct redirects, just redirect to home
  // The AuthProvider will handle token processing from URL hash
  return NextResponse.redirect(new URL('/', origin))
}