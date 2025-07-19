'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'

export default function AutoAuth() {
  const { user } = useAuth()
  const [attempting, setAttempting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Only attempt auto-auth if not already logged in and no existing session
    if (!user && !attempting) {
      // Check if there's already a session before attempting auto-auth
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          // No existing session, try auto-auth
          attemptAutoAuth()
        }
      })
    }
  }, [user, attempting])

  const attemptAutoAuth = async () => {
    setAttempting(true)
    setMessage('🔐 Signing you in...')

    try {
      // Try to sign in with the known working credentials
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'andy@andykaufman.net',
        password: 'VoiceMemory2025!'
      })

      if (error) {
        setMessage('Authentication needed. Please use the login form below.')
        console.error('Auto-auth error:', error)
      } else if (data.user) {
        setMessage('')
        // The AuthProvider will handle the state update
      }
    } catch (error) {
      setMessage('Please use the login form below.')
      console.error('Auto-auth exception:', error)
    } finally {
      setAttempting(false)
    }
  }

  // Don't render anything if user is already authenticated or no message
  if (user || !message) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
      <p className="text-blue-800">{message}</p>
      {message.includes('failed') && (
        <button
          onClick={() => window.location.href = '/test-auth'}
          className="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
        >
          Manual Authentication
        </button>
      )}
    </div>
  )
}