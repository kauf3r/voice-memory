'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔄 Processing auth callback on client side...')
        console.log('Current URL:', window.location.href)
        console.log('Hash:', window.location.hash)
        console.log('Search:', window.location.search)
        
        // Get the URL hash which contains auth tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        
        // Also check URL search params for code flow
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const error = urlParams.get('error')
        const errorDescription = urlParams.get('error_description')
        
        console.log('Auth callback params:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          hasCode: !!code,
          error,
          errorDescription,
          fullUrl: window.location.href
        })

        if (error) {
          console.error('❌ Auth callback error:', error)
          router.push(`/?error=${encodeURIComponent(error)}`)
          return
        }

        if (accessToken && refreshToken) {
          // Handle token-based auth (direct tokens)
          console.log('✅ Setting session from tokens...')
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          
          if (sessionError) {
            console.error('❌ Session error:', sessionError)
            router.push(`/?error=${encodeURIComponent(sessionError.message)}`)
            return
          }
          
          console.log('✅ Session set successfully:', data.session?.user?.id)
          router.push('/')
          
        } else if (code) {
          // Handle code-based auth (PKCE flow)
          console.log('✅ Exchanging code for session...')
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (exchangeError) {
            console.error('❌ Code exchange error:', exchangeError)
            router.push(`/?error=${encodeURIComponent(exchangeError.message)}`)
            return
          }
          
          console.log('✅ Code exchanged successfully:', data.session?.user?.id)
          router.push('/')
          
        } else {
          console.log('ℹ️ No auth tokens found, redirecting to home')
          router.push('/')
        }
        
      } catch (error) {
        console.error('❌ Auth callback exception:', error)
        router.push(`/?error=${encodeURIComponent('Authentication failed')}`)
      }
    }

    // Small delay to ensure the component is mounted
    const timeout = setTimeout(handleAuthCallback, 100)
    return () => clearTimeout(timeout)
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}