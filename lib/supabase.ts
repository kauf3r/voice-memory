import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  })
}

// Create a client with enhanced session persistence and timeout handling
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    // Use default localStorage storage
    storageKey: `sb-${supabaseUrl?.split('//')[1]?.split('.')[0] || 'default'}-auth-token`,
    flowType: 'implicit', // Use implicit flow for simpler magic link handling
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    // Add timeout for auth operations
    debug: process.env.NODE_ENV === 'development'
  },
  global: {
    headers: {
      'x-client-info': 'voice-memory-nextjs'
    }
  }
})

// Helper function to manually process auth tokens from URL hash
export const processUrlTokens = async () => {
  if (typeof window === 'undefined') return null

  const hash = window.location.hash
  if (!hash || !hash.includes('access_token')) return null

  console.log('🔍 Processing URL tokens manually...')
  
  try {
    const hashParams = new URLSearchParams(hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    
    if (accessToken && refreshToken) {
      console.log('🔐 Setting session from URL tokens...')
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })
      
      if (error) {
        console.error('❌ Failed to set session:', error)
        return { error }
      }
      
      if (data?.session) {
        console.log('✅ Session set successfully:', data.session.user.id)
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
        return { session: data.session }
      }
    }
  } catch (error) {
    console.error('❌ Token processing error:', error)
    return { error }
  }
  
  return null
}