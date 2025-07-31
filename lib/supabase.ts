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
    flowType: 'pkce',
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