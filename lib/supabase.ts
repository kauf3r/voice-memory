import { createClient } from '@supabase/supabase-js'

// Validate required environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Create the Supabase client with optimized configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'voice-memory-app',
    },
  },
})

// Enhanced error handling for development
if (process.env.NODE_ENV === 'development') {
  console.log('🔌 Supabase client initialized:', {
    url: supabaseUrl.substring(0, 30) + '...',
    hasAnonKey: !!supabaseAnonKey,
    version: '2.0.0'
  })
}

// Add connection monitoring
supabase.realtime.onOpen(() => {
  console.log('🟢 Supabase realtime connected')
})

supabase.realtime.onClose(() => {
  console.log('🔴 Supabase realtime disconnected')
})

supabase.realtime.onError((error) => {
  console.error('❌ Supabase realtime error:', error)
})

// Export default for backward compatibility
export default supabase