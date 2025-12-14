'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import ErrorMessage from './ErrorMessage'
import LoadingSpinner from './LoadingSpinner'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  
  const { signInWithEmail } = useAuth()

  // Check for error in URL parameters (from auth callback)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check URL search params
      const urlParams = new URLSearchParams(window.location.search)
      const urlError = urlParams.get('error')
      const urlDetails = urlParams.get('details')

      // Also check hash params (for Supabase errors)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const hashError = hashParams.get('error')
      const hashErrorCode = hashParams.get('error_code')
      const hashErrorDescription = hashParams.get('error_description')

      if (urlError) {
        // Use the details if provided, otherwise use the error code
        const errorMessage = urlDetails ? decodeURIComponent(urlDetails) : decodeURIComponent(urlError)
        console.log('Auth callback error:', urlError, errorMessage)
        setError(errorMessage)
      } else if (hashError) {
        let errorMessage = decodeURIComponent(hashErrorDescription || hashError)
        if (hashErrorCode === 'otp_expired') {
          errorMessage = 'The magic link has expired. Please request a new one.'
        }
        console.log('Auth error from hash:', errorMessage)
        setError(errorMessage)
      }

      // Clear the error from URL after a short delay
      if (urlError || hashError) {
        setTimeout(() => {
          window.history.replaceState({}, '', window.location.pathname)
        }, 100)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await signInWithEmail(email)
    
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Check your email</h2>
            <p className="mt-4 text-gray-600">
              We've sent a magic link to <strong>{email}</strong>
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Click the link in your email to sign in to Voice Memory.
            </p>
          </div>
          <div className="text-center">
            <button
              onClick={() => setSent(false)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Try a different email
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Voice Memory</h1>
          <p className="mt-4 text-gray-600">
            Transform your voice notes into actionable insights with AI
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-800 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border-2 border-gray-300 rounded-md shadow-sm bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
              placeholder="Enter your email address"
            />
          </div>

          {error && (
            <ErrorMessage 
              title="Sign in failed"
              message={error}
              onRetry={() => setError(null)}
            />
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              'Send magic link'
            )}
          </button>
        </form>

        <div className="text-center text-sm text-gray-500">
          <p>We'll send you a secure link to sign in without a password.</p>
        </div>
      </div>
    </div>
  )
}