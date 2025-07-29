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
        return NextResponse.redirect(new URL('/?error=' + encodeURIComponent('Authentication failed'), request.url))
      }
      
      if (data?.session) {
        console.log('Session created successfully for user:', data.session.user.id)
      }
    } catch (error) {
      console.error('Exception during code exchange:', error)
      return NextResponse.redirect(new URL('/?error=' + encodeURIComponent('Authentication error'), request.url))
    }
  }

  // URL to redirect to after sign in process completes
  console.log('Redirecting to home page')
  return NextResponse.redirect(new URL('/', request.url))
}