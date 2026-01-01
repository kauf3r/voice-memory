import { createBrowserClient } from '@supabase/ssr'

// Validate required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// Clean and validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

// Global singleton to prevent multiple instances
const GLOBAL_KEY = '__VOICE_MEMORY_SUPABASE_CLIENT__'

// Create the Supabase client using SSR package for consistent cookie-based auth
function createSupabaseClient() {
  // Check for existing global instance first
  if (typeof window !== 'undefined' && (window as any)[GLOBAL_KEY]) {
    return (window as any)[GLOBAL_KEY]
  }

  // Use createBrowserClient from @supabase/ssr for cookie-based session storage
  // This matches the server-side createServerSupabaseClient for consistent auth
  const client = createBrowserClient(supabaseUrl!, supabaseAnonKey!)

  // Store globally in browser
  if (typeof window !== 'undefined') {
    (window as any)[GLOBAL_KEY] = client
  }

  // Enhanced error handling for development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔌 Supabase browser client initialized (cookie-based auth):', {
      url: supabaseUrl?.substring(0, 30) + '...',
      hasAnonKey: !!supabaseAnonKey
    })
  }

  return client
}

// Export singleton instance
export const supabase = createSupabaseClient()

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

// Export default for backward compatibility
export default supabase