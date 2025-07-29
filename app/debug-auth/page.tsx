'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../components/AuthProvider'
import { supabase } from '@/lib/supabase'

export default function DebugAuthPage() {
  const { user, loading } = useAuth()
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [storageInfo, setStorageInfo] = useState<any>(null)

  useEffect(() => {
    const checkAuth = async () => {
      // Check current session
      const { data: { session }, error } = await supabase.auth.getSession()
      
      setSessionInfo({
        hasSession: !!session,
        userEmail: session?.user?.email,
        userId: session?.user?.id,
        expiresAt: session?.expires_at,
        error: error?.message
      })

      // Check localStorage
      const storageKey = `sb-vbjszugsvrqxosbtffqw-auth-token`
      const storedAuth = localStorage.getItem(storageKey)
      
      setStorageInfo({
        hasStoredAuth: !!storedAuth,
        storageKey,
        storedData: storedAuth ? JSON.parse(storedAuth) : null
      })
    }

    checkAuth()
  }, [])

  const handleRefreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      console.log('Session refresh result:', { data, error })
      
      // Reload the page to see updated state
      window.location.reload()
    } catch (error) {
      console.error('Session refresh failed:', error)
    }
  }

  const handleClearStorage = () => {
    localStorage.clear()
    sessionStorage.clear()
    console.log('Storage cleared')
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">🔍 Authentication Debug Page</h1>
        
        <div className="space-y-6">
          {/* Auth Provider State */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">🔐 Auth Provider State</h2>
            <div className="space-y-2">
              <div><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</div>
              <div><strong>User:</strong> {user ? user.email : 'None'}</div>
              <div><strong>User ID:</strong> {user ? user.id : 'None'}</div>
            </div>
          </div>

          {/* Session Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">📋 Session Information</h2>
            {sessionInfo ? (
              <div className="space-y-2">
                <div><strong>Has Session:</strong> {sessionInfo.hasSession ? '✅ Yes' : '❌ No'}</div>
                <div><strong>User Email:</strong> {sessionInfo.userEmail || 'None'}</div>
                <div><strong>User ID:</strong> {sessionInfo.userId || 'None'}</div>
                <div><strong>Expires At:</strong> {sessionInfo.expiresAt ? new Date(sessionInfo.expiresAt * 1000).toLocaleString() : 'None'}</div>
                {sessionInfo.error && (
                  <div><strong>Error:</strong> <span className="text-red-600">{sessionInfo.error}</span></div>
                )}
              </div>
            ) : (
              <div>Loading session info...</div>
            )}
          </div>

          {/* Storage Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">💾 Local Storage</h2>
            {storageInfo ? (
              <div className="space-y-2">
                <div><strong>Has Stored Auth:</strong> {storageInfo.hasStoredAuth ? '✅ Yes' : '❌ No'}</div>
                <div><strong>Storage Key:</strong> {storageInfo.storageKey}</div>
                {storageInfo.storedData && (
                  <div>
                    <strong>Stored Data:</strong>
                    <pre className="bg-gray-100 p-2 rounded text-sm mt-2 overflow-auto">
                      {JSON.stringify(storageInfo.storedData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div>Loading storage info...</div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">🛠️ Debug Actions</h2>
            <div className="space-x-4">
              <button
                onClick={handleRefreshSession}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Refresh Session
              </button>
              <button
                onClick={handleClearStorage}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Clear Storage & Reload
              </button>
              <a
                href="/auth/callback"
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 inline-block"
              >
                Test Auth Callback
              </a>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <h3 className="text-lg font-medium text-yellow-800 mb-2">📝 Debugging Steps</h3>
            <ol className="list-decimal list-inside space-y-1 text-yellow-700">
              <li>If you see "Has Session: No", you need to log in again</li>
              <li>Go to <a href="/" className="underline">homepage</a> and enter: <strong>andy@andykaufman.net</strong></li>
              <li>Click "Send Magic Link" and check your email</li>
              <li>Click the magic link in your email - it should redirect you back</li>
              <li>Return to this page to verify the session is created</li>
              <li>Then try the <a href="/knowledge" className="underline">knowledge page</a></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}