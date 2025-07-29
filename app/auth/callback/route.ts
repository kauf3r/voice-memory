import { createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// Force dynamic behavior to handle auth callback properly
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const error_description = requestUrl.searchParams.get('error_description')

  console.log('Auth callback called:', { 
    hasCode: !!code, 
    error, 
    error_description,
    url: requestUrl.toString(),
    origin: requestUrl.origin,
    pathname: requestUrl.pathname 
  })

  if (error) {
    console.error('Auth callback error:', error, error_description)
    // Redirect to login with error
    return NextResponse.redirect(new URL('/?error=' + encodeURIComponent(error_description || error), request.url))
  }

  if (code) {
    try {
      const supabase = createServerClient()
      console.log('Exchanging code for session...')
      
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('Failed to exchange code for session:', exchangeError)
        return NextResponse.redirect(new URL('/?error=' + encodeURIComponent('Authentication failed: ' + exchangeError.message), request.url))
      }
      
      if (data?.session) {
        console.log('Session created successfully for user:', data.session.user.id)
        console.log('Session expires at:', data.session.expires_at)
        
        // Create response with redirect
        const response = NextResponse.redirect(new URL('/', request.url))
        
        // Set session cookies to ensure client-side detection
        const { access_token, refresh_token, expires_at } = data.session
        
        // Set cookies that match the Supabase client configuration
        const cookieOptions = {
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          httpOnly: false, // Allow client-side access
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const
        }
        
        const storageKey = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'default'}-auth-token`
        
        response.cookies.set(storageKey, JSON.stringify({
          access_token,
          refresh_token,
          expires_at,
          user: data.session.user
        }), cookieOptions)
        
        return response
      } else {
        console.warn('Code exchange succeeded but no session returned')
        return NextResponse.redirect(new URL('/?error=' + encodeURIComponent('No session created'), request.url))
      }
    } catch (error) {
      console.error('Exception during code exchange:', error)
      return NextResponse.redirect(new URL('/?error=' + encodeURIComponent('Authentication error: ' + (error as Error).message), request.url))
    }
  }

  // URL to redirect to after sign in process completes
  console.log('Redirecting to home page')
  return NextResponse.redirect(new URL('/', request.url))
}