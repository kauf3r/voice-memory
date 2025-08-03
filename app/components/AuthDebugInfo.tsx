'use client'

import { useAuth } from './AuthProvider'
import { useState } from 'react'

export default function AuthDebugInfo() {
  const { user, loading } = useAuth()
  const [showDebug, setShowDebug] = useState(false)

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="bg-gray-800 text-white px-3 py-1 rounded text-xs hover:bg-gray-700"
      >
        Auth Debug
      </button>
      
      {showDebug && (
        <div className="absolute bottom-8 right-0 bg-white border border-gray-300 rounded shadow-lg p-4 w-80 text-xs">
          <h3 className="font-semibold mb-2">Auth Debug Info</h3>
          
          <div className="space-y-1">
            <div><strong>User ID:</strong> {user?.id || 'null'}</div>
            <div><strong>Loading:</strong> {loading.toString()}</div>
            <div><strong>User Email:</strong> {user?.email || 'null'}</div>
            <div><strong>Timestamp:</strong> {new Date().toLocaleTimeString()}</div>
          </div>
        </div>
      )}
    </div>
  )
}