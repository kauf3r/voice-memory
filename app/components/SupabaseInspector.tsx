'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function SupabaseInspector() {
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const inspectSupabase = async () => {
    setLoading(true)
    const inspection: any = {}

    try {
      // Step 1: Environment inspection
      inspection.step1_environment = {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
          `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 'missing',
        anonKeyFull: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        urlValid: !!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://'),
        keyValid: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.startsWith('eyJ')
      }

      // Step 2: Client creation with detailed error handling
      let supabase: any = null
      try {
        console.log('Creating Supabase client with:', {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          keyStart: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20)
        })
        
        supabase = createClientComponentClient()
        inspection.step2_client_creation = {
          success: true,
          clientType: typeof supabase,
          hasAuth: !!supabase.auth,
          hasFrom: !!supabase.from,
          authType: typeof supabase.auth
        }
      } catch (err) {
        inspection.step2_client_creation = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : null
        }
      }

      if (supabase) {
        // Step 3: Auth object inspection
        try {
          inspection.step3_auth_object = {
            exists: !!supabase.auth,
            methods: supabase.auth ? Object.getOwnPropertyNames(Object.getPrototypeOf(supabase.auth)) : [],
            getSession: typeof supabase.auth?.getSession,
            signInWithOtp: typeof supabase.auth?.signInWithOtp
          }
        } catch (err) {
          inspection.step3_auth_object = {
            error: err instanceof Error ? err.message : String(err)
          }
        }

        // Step 4: Session retrieval test
        try {
          console.log('Testing getSession...')
          const sessionResult = await supabase.auth.getSession()
          inspection.step4_session_test = {
            success: true,
            hasSession: !!sessionResult.data.session,
            user: sessionResult.data.session?.user?.email || null,
            error: sessionResult.error?.message || null,
            errorCode: sessionResult.error?.code || null
          }
        } catch (err) {
          inspection.step4_session_test = {
            success: false,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack?.substring(0, 500) : null
          }
        }

        // Step 5: Database query test (without auth)
        try {
          console.log('Testing database query...')
          const { data, error } = await supabase.from('notes').select('count').limit(1)
          inspection.step5_database_test = {
            success: !error,
            error: error?.message || null,
            errorCode: error?.code || null,
            errorDetails: error?.details || null,
            errorHint: error?.hint || null,
            dataReceived: !!data
          }
        } catch (err) {
          inspection.step5_database_test = {
            success: false,
            error: err instanceof Error ? err.message : String(err)
          }
        }

        // Step 6: Manual auth test with detailed logging
        try {
          console.log('Testing manual auth...')
          const authResponse = await supabase.auth.signInWithOtp({
            email: 'test@example.com',
            options: { shouldCreateUser: false }
          })
          inspection.step6_auth_test = {
            success: !authResponse.error,
            error: authResponse.error?.message || null,
            errorCode: authResponse.error?.code || null,
            data: authResponse.data ? 'received' : 'none'
          }
        } catch (err) {
          inspection.step6_auth_test = {
            success: false,
            error: err instanceof Error ? err.message : String(err)
          }
        }
      }

      // Step 7: Network connectivity test
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          }
        })
        
        inspection.step7_network_test = {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        }
      } catch (err) {
        inspection.step7_network_test = {
          success: false,
          error: err instanceof Error ? err.message : String(err)
        }
      }

    } catch (globalErr) {
      inspection.global_error = {
        error: globalErr instanceof Error ? globalErr.message : String(globalErr),
        stack: globalErr instanceof Error ? globalErr.stack : null
      }
    }

    setResults(inspection)
    setLoading(false)
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Supabase Client Inspector</h2>
        <button
          onClick={inspectSupabase}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Inspecting...' : 'Run Full Inspection'}
        </button>
      </div>

      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          {Object.entries(results).map(([step, data]) => (
            <div key={step} className="border border-gray-200 rounded p-3">
              <h3 className="font-semibold text-lg mb-2 capitalize">
                {step.replace(/_/g, ' ')}
              </h3>
              <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-600">Running comprehensive Supabase inspection...</p>
        </div>
      )}
    </div>
  )
}