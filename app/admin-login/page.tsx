'use client'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminLogin() {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAdminLogin = async () => {
    setIsLoading(true)
    setMessage('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@voicememory.test',
        password: 'VoiceMemory2025!'
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else if (data.user) {
        setMessage('✅ Login successful! Redirecting...')
        setTimeout(() => {
          window.location.href = '/'
        }, 1000)
      }
    } catch (error) {
      setMessage(`Unexpected error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMagicLink = async () => {
    setIsLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: 'admin@voicememory.test'
      })

      if (error) {
        setMessage(`Error: ${error.message}`)
      } else {
        setMessage('✅ Magic link sent! Check your email.')
      }
    } catch (error) {
      setMessage(`Unexpected error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Admin Access
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Access your processed Voice Memory notes
          </p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={handleAdminLogin}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign in as Admin'}
          </button>

          <button
            onClick={handleMagicLink}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Send Magic Link
          </button>
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded ${message.includes('Error') || message.includes('error') 
            ? 'bg-red-50 text-red-700 border border-red-200' 
            : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {message}
          </div>
        )}

        <div className="mt-8 bg-gray-100 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">What you'll see after login:</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• 4 processed audio files with complete analysis</li>
            <li>• 7-point AI analysis (sentiment, tasks, ideas, messages)</li>
            <li>• Professional message drafts ready to send</li>
            <li>• Interactive analysis tabs with detailed insights</li>
          </ul>
        </div>
      </div>
    </div>
  )
}