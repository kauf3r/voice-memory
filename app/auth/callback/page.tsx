'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔄 Processing auth callback...')
        
        // Get the current URL to check for auth parameters
        const url = new URL(window.location.href)
        console.log('Current URL:', url.toString())
        
        // Check if we have an error
        const error = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')
        
        if (error) {
          console.error('❌ Auth error:', error, errorDescription)
          router.push(`/?error=${encodeURIComponent(errorDescription || error)}`)
          return
        }

        // Try to get the session from Supabase
        // This should work if the magic link set the session correctly
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError)
          router.push(`/?error=${encodeURIComponent(sessionError.message)}`)
          return
        }

        if (session) {
          console.log('✅ Session found:', session.user.id)
          router.push('/')
          return
        }

        // If no session, check URL hash for tokens (implicit flow)
        if (window.location.hash) {
          console.log('🔍 Checking hash for tokens...')
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          
          if (accessToken && refreshToken) {
            console.log('✅ Found tokens in hash, setting session...')
            const { data, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            })
            
            if (setSessionError) {
              console.error('❌ Failed to set session:', setSessionError)
              router.push(`/?error=${encodeURIComponent(setSessionError.message)}`)
              return
            }
            
            console.log('✅ Session set successfully')
            router.push('/')
            return
          }
        }

        // If we get here, something went wrong
        console.log('⚠️ No session or tokens found')
        router.push('/?error=' + encodeURIComponent('Authentication failed - please try again'))
        
      } catch (error) {
        console.error('❌ Callback error:', error)
        router.push(`/?error=${encodeURIComponent('Authentication error')}`)
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  )
}