import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey
  })
}

// Create a client with enhanced session persistence and WebSocket optimization
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    // Use default localStorage storage
    storageKey: `sb-${supabaseUrl?.split('//')[1]?.split('.')[0] || 'default'}-auth-token`,
    flowType: 'implicit', // Use implicit flow for simpler magic link handling
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    // Add timeout for auth operations
    debug: process.env.NODE_ENV === 'development' // Only debug in development
  },
  realtime: {
    // WebSocket configuration for better reliability
    timeout: 30000, // 30 second timeout
    heartbeatIntervalMs: 30000, // Send heartbeat every 30 seconds
    reconnectAfterMs: (tries: number) => {
      // Exponential backoff with jitter: 1s, 2s, 4s, 8s, max 30s
      const baseDelay = Math.min(1000 * Math.pow(2, tries), 30000)
      const jitter = baseDelay * 0.1 * Math.random() // Add up to 10% jitter
      return Math.floor(baseDelay + jitter)
    },
    // Logger for debugging WebSocket issues
    logger: process.env.NODE_ENV === 'development' ? console.log : undefined,
    // Transport options for WebSocket
    transport: 'websocket',
    // Additional params for debugging
    params: {
      apikey: supabaseAnonKey || '',
      log_level: process.env.NODE_ENV === 'development' ? 'info' : 'error'
    }
  },
  global: {
    headers: {
      'x-client-info': 'voice-memory-nextjs',
      'x-client-version': '1.0.0'
    }
  },
  // Connection pooling and reuse
  db: {
    schema: 'public',
  },
  // Add fetch configuration for better error handling
  fetch: (url: RequestInfo | URL, init?: RequestInit) => {
    const customInit = {
      ...init,
      // Set reasonable timeouts for HTTP requests
      signal: init?.signal || AbortSignal.timeout(30000), // 30s timeout
    }
    return fetch(url, customInit)
  }
})

// Force session check on initialization
if (typeof window !== 'undefined') {
  supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (error) {
      console.error('Initial session check error:', error)
    } else if (session) {
      console.log('Session found on initialization:', session.user?.email)
    } else {
      console.log('No session found on initialization')
    }
  })
}

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