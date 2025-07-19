'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestAuth() {
  const [status, setStatus] = useState('Checking authentication...')
  const [user, setUser] = useState(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        setStatus(`Session error: ${error.message}`)
        return
      }

      if (session?.user) {
        setUser(session.user)
        setStatus('✅ Already authenticated! Redirecting...')
        setTimeout(() => {
          window.location.href = '/'
        }, 2000)
      } else {
        setStatus('No session found. Attempting login...')
        await performLogin()
      }
    } catch (error) {
      setStatus(`Auth check error: ${error}`)
    }
  }

  const performLogin = async () => {
    try {
      setStatus('🔐 Attempting authentication with known credentials...')
      
      // Try multiple authentication methods
      const credentials = [
        { email: 'andy@andykaufman.net', password: 'VoiceMemory2025!' },
        { email: 'admin@voicememory.test', password: 'VoiceMemory2025!' }
      ]
      
      for (const cred of credentials) {
        setStatus(`🔄 Trying ${cred.email}...`)
        
        const { data, error } = await supabase.auth.signInWithPassword(cred)

        if (!error && data.user) {
          setUser(data.user)
          setStatus(`✅ Login successful with ${cred.email}! Redirecting to dashboard...`)
          setTimeout(() => {
            window.location.href = '/'
          }, 1500)
          return
        } else if (error) {
          console.log(`Failed with ${cred.email}:`, error.message)
        }
      }
      
      // If all login attempts failed, try to create the user
      setStatus('🔄 Creating new user account...')
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'andy@andykaufman.net',
        password: 'VoiceMemory2025!'
      })

      if (signUpError) {
        setStatus(`❌ All authentication methods failed. Error: ${signUpError.message}`)
        setStatus('🎯 Try the magic link method or manual login below.')
      } else {
        setStatus('✅ New user created! You may need to verify your email.')
        if (signUpData.user) {
          setUser(signUpData.user)
        }
      }
    } catch (error) {
      setStatus(`❌ Authentication error: ${error}`)
    }
  }

  const tryMagicLink = async () => {
    try {
      setStatus('📧 Sending magic link...')
      const { error } = await supabase.auth.signInWithOtp({
        email: 'andy@andykaufman.net'
      })

      if (error) {
        setStatus(`❌ Magic link error: ${error.message}`)
      } else {
        setStatus('✅ Magic link sent! Check your email at andy@andykaufman.net')
      }
    } catch (error) {
      setStatus(`❌ Magic link failed: ${error}`)
    }
  }

  const goToDashboard = () => {
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-center mb-6">Voice Memory Auth Test</h1>
          
          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
              <p className="text-sm text-blue-800">{status}</p>
            </div>

            {user && (
              <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
                <p className="text-sm text-green-800">
                  <strong>Logged in as:</strong> {user.email}
                </p>
                <p className="text-sm text-green-800">
                  <strong>User ID:</strong> {user.id}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={performLogin}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Try Login Again
            </button>

            <button
              onClick={tryMagicLink}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
            >
              Send Magic Link
            </button>

            <button
              onClick={goToDashboard}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700"
            >
              Go to Dashboard Anyway
            </button>
          </div>

          <div className="mt-8 bg-gray-100 rounded p-4">
            <h3 className="font-medium mb-2">Expected after authentication:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 4 processed audio files will appear</li>
              <li>• Complete 7-point AI analysis for each</li>
              <li>• Professional message drafts ready</li>
              <li>• Interactive analysis tabs</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}