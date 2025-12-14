'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// Dev-only authentication page for automated testing
// This page only works in development mode

export default function DevAuthPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'not-dev'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Check if we're in development
    if (process.env.NODE_ENV !== 'development') {
      setStatus('not-dev')
      setMessage('This page is only available in development mode')
      return
    }

    async function autoAuth() {
      try {
        setMessage('Fetching dev auth tokens...')

        // Get tokens from dev-auth API
        const response = await fetch('/api/dev-auth')
        const data = await response.json()

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to get dev auth tokens')
        }

        setMessage('Setting session...')

        // Set the session in Supabase client
        const { error } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })

        if (error) {
          throw error
        }

        setStatus('success')
        setMessage(`Authenticated as ${data.user.email}. Redirecting...`)

        // Redirect to home page after short delay
        setTimeout(() => {
          router.push('/')
        }, 1000)

      } catch (error) {
        console.error('Dev auth failed:', error)
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Authentication failed')
      }
    }

    autoAuth()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4 text-center">
          Dev Authentication
        </h1>

        {status === 'loading' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="text-green-500 text-4xl mb-4">✓</div>
            <p className="text-green-600">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">✗</div>
            <p className="text-red-600">{message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        )}

        {status === 'not-dev' && (
          <div className="text-center">
            <div className="text-yellow-500 text-4xl mb-4">⚠</div>
            <p className="text-yellow-600">{message}</p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6 text-center">
          This page is for development testing only.
        </p>
      </div>
    </div>
  )
}
