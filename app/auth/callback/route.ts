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
  
  // Also check for token-based parameters (hash fragments are not available server-side)
  const access_token = requestUrl.searchParams.get('access_token')
  const refresh_token = requestUrl.searchParams.get('refresh_token')

  console.log('🔄 Auth callback called:', { 
    hasCode: !!code, 
    hasAccessToken: !!access_token,
    hasRefreshToken: !!refresh_token,
    error, 
    error_description,
    url: requestUrl.toString(),
    origin: requestUrl.origin,
    pathname: requestUrl.pathname,
    userAgent: request.headers.get('user-agent'),
    timestamp: new Date().toISOString()
  })

  if (error) {
    console.error('❌ Auth callback error:', error, error_description)
    // Redirect to login with error
    return NextResponse.redirect(new URL('/?error=' + encodeURIComponent(error_description || error), request.url))
  }

  // Handle token-based authentication (implicit flow)
  if (access_token && refresh_token) {
    try {
      console.log('✅ Processing token-based authentication...')
      const supabase = createServerClient()
      
      // Set the session using the provided tokens
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token
      })
      
      if (sessionError) {
        console.error('❌ Failed to set session from tokens:', sessionError)
        return NextResponse.redirect(new URL('/?error=' + encodeURIComponent('Token authentication failed: ' + sessionError.message), request.url))
      }
      
      if (data?.session) {
        console.log('✅ Token-based session created successfully for user:', data.session.user.id)
        
        // Create response with redirect
        const response = NextResponse.redirect(new URL('/', request.url))
        
        // Set session cookies
        const { access_token: newAccessToken, refresh_token: newRefreshToken, expires_at } = data.session
        
        const cookieOptions = {
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 days
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const
        }
        
        const storageKey = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] || 'default'}-auth-token`
        
        response.cookies.set(storageKey, JSON.stringify({
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
          expires_at,
          user: data.session.user
        }), cookieOptions)
        
        return response
      }
    } catch (error) {
      console.error('❌ Exception during token-based auth:', error)
      return NextResponse.redirect(new URL('/?error=' + encodeURIComponent('Token processing error: ' + (error as Error).message), request.url))
    }
  }

  // Handle code-based authentication (PKCE flow)
  if (code) {
    try {
      const supabase = createServerClient()
      console.log('✅ Processing code-based authentication...')
      
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('❌ Failed to exchange code for session:', exchangeError)
        return NextResponse.redirect(new URL('/?error=' + encodeURIComponent('Authentication failed: ' + exchangeError.message), request.url))
      }
      
      if (data?.session) {
        console.log('✅ Code-based session created successfully for user:', data.session.user.id)
        console.log('📅 Session expires at:', data.session.expires_at)
        
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
        console.warn('⚠️ Code exchange succeeded but no session returned')
        return NextResponse.redirect(new URL('/?error=' + encodeURIComponent('No session created'), request.url))
      }
    } catch (error) {
      console.error('❌ Exception during code exchange:', error)
      return NextResponse.redirect(new URL('/?error=' + encodeURIComponent('Authentication error: ' + (error as Error).message), request.url))
    }
  }

  // If no code or tokens are found, this might be a hash-based redirect
  // Create a client-side redirect page to handle hash fragments
  console.log('ℹ️ No authentication parameters found, creating client-side handler for hash-based tokens')
  
  const clientSideHandler = `
<!DOCTYPE html>
<html>
<head>
  <title>Completing sign in...</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f9fafb; }
    .spinner { width: 24px; height: 24px; border: 2px solid #e5e7eb; border-top: 2px solid #2563eb; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div style="text-align: center;">
    <div class="spinner"></div>
    <p style="margin-top: 16px; color: #6b7280;">Completing sign in...</p>
  </div>
  <script>
    console.log('🔄 Client-side auth handler - checking for hash tokens...');
    console.log('Current URL:', window.location.href);
    console.log('Hash:', window.location.hash);
    
    // Check for hash-based tokens (common with implicit flow)
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const error = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');
    
    console.log('Hash params:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken, error });
    
    if (error) {
      console.error('❌ Hash-based auth error:', error, errorDescription);
      window.location.href = '/?error=' + encodeURIComponent(errorDescription || error);
    } else if (accessToken) {
      console.log('✅ Found hash-based tokens, redirecting to process them...');
      // Convert hash params to query params and redirect back to this route
      const url = new URL('/auth/callback', window.location.origin);
      url.searchParams.set('access_token', accessToken);
      if (refreshToken) url.searchParams.set('refresh_token', refreshToken);
      window.location.href = url.toString();
    } else {
      console.log('ℹ️ No authentication tokens found, redirecting to home');
      window.location.href = '/';
    }
  </script>
</body>
</html>`;

  return new Response(clientSideHandler, {
    headers: { 'Content-Type': 'text/html' },
  });
}