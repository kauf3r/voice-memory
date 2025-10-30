'use client'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import SupabaseInspector from '../components/SupabaseInspector'

export default function DebugFrontend() {
  const [diagnostics, setDiagnostics] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [authTest, setAuthTest] = useState<any>({})

  useEffect(() => {
    runDiagnostics()
  }, [])

  const runDiagnostics = async () => {
    setLoading(true)
    const results: any = {}

    // 1. Check environment variables
    results.environment = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
      anonKeyStart: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20) + '...',
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      nodeEnv: process.env.NODE_ENV
    }

    // 2. Test Supabase client inspection
    try {
      results.supabaseClient = {
        created: true,
        type: typeof supabase,
        hasAuth: !!supabase.auth,
        hasFrom: !!supabase.from
      }

      // 3. Test basic auth methods
      try {
        const session = await supabase.auth.getSession()
        results.authMethods = {
          getSession: {
            success: true,
            hasSession: !!session.data.session,
            user: session.data.session?.user?.email || 'none',
            error: session.error?.message || null
          }
        }
      } catch (err) {
        results.authMethods = {
          getSession: {
            success: false,
            error: err instanceof Error ? err.message : 'unknown error'
          }
        }
      }

      // 4. Test database connection
      try {
        const { data, error } = await supabase.from('notes').select('count').limit(1)
        results.databaseTest = {
          success: !error,
          error: error?.message || null,
          dataReceived: !!data
        }
      } catch (err) {
        results.databaseTest = {
          success: false,
          error: err instanceof Error ? err.message : 'unknown error'
        }
      }

    } catch (err) {
      results.supabaseClient = {
        created: false,
        error: err instanceof Error ? err.message : 'unknown error'
      }
    }

    // 5. Browser environment checks
    results.browser = {
      userAgent: navigator.userAgent,
      localStorage: {
        available: typeof localStorage !== 'undefined',
        supabaseKeys: typeof localStorage !== 'undefined' ? 
          Object.keys(localStorage).filter(key => key.includes('supabase')) : []
      },
      cookies: document.cookie,
      location: {
        origin: window.location.origin,
        href: window.location.href
      }
    }

    setDiagnostics(results)
    setLoading(false)
  }

  const testMagicLink = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: 'andy@andykaufman.net',
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      setAuthTest({
        magicLink: {
          success: !error,
          error: error?.message || null,
          data: data
        }
      })
    } catch (err) {
      setAuthTest({
        magicLink: {
          success: false,
          error: err instanceof Error ? err.message : 'unknown error'
        }
      })
    }
  }

  const clearStorage = () => {
    if (typeof localStorage !== 'undefined') {
      const supabaseKeys = Object.keys(localStorage).filter(key => key.includes('supabase'))
      supabaseKeys.forEach(key => localStorage.removeItem(key))
    }
    
    // Clear cookies
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
      if (name.trim().includes('supabase')) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      }
    })
    
    runDiagnostics()
  }

  if (loading) {
    return <div className="p-8">Loading diagnostics...</div>
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Frontend Authentication Diagnostics</h1>
      
      {/* Supabase Inspector */}
      <div className="mb-8">
        <SupabaseInspector />
      </div>
      
      <div className="grid gap-6">
        {/* Environment Variables */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Environment Variables</h2>
          <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
            {JSON.stringify(diagnostics.environment, null, 2)}
          </pre>
        </div>

        {/* Supabase Client */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Supabase Client</h2>
          <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
            {JSON.stringify(diagnostics.supabaseClient, null, 2)}
          </pre>
        </div>

        {/* Auth Methods */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Authentication Methods</h2>
          <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
            {JSON.stringify(diagnostics.authMethods, null, 2)}
          </pre>
        </div>

        {/* Database Test */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Database Connection Test</h2>
          <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
            {JSON.stringify(diagnostics.databaseTest, null, 2)}
          </pre>
        </div>

        {/* Browser Environment */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Browser Environment</h2>
          <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
            {JSON.stringify(diagnostics.browser, null, 2)}
          </pre>
        </div>

        {/* Test Actions */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Test Actions</h2>
          <div className="flex gap-4 mb-4">
            <button 
              onClick={testMagicLink}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Test Magic Link
            </button>
            <button 
              onClick={clearStorage}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Clear Storage & Cookies
            </button>
            <button 
              onClick={runDiagnostics}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Refresh Diagnostics
            </button>
          </div>
          
          {Object.keys(authTest).length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Test Results:</h3>
              <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
                {JSON.stringify(authTest, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Network Test */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Network Test</h2>
          <button 
            onClick={async () => {
              try {
                const response = await fetch('/api/debug-env')
                const data = await response.json()
                setDiagnostics((prev: any) => ({
                  ...prev,
                  networkTest: {
                    success: response.ok,
                    status: response.status,
                    data: data
                  }
                }))
              } catch (err) {
                setDiagnostics((prev: any) => ({
                  ...prev,
                  networkTest: {
                    success: false,
                    error: err instanceof Error ? err.message : 'unknown error'
                  }
                }))
              }
            }}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 mb-3"
          >
            Test Backend Connection
          </button>
          
          {diagnostics.networkTest && (
            <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
              {JSON.stringify(diagnostics.networkTest, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}