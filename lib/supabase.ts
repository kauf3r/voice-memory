import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a client with improved session persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? {
      getItem: (key: string) => {
        // Try localStorage first, then check cookies as fallback
        const localValue = window.localStorage.getItem(key)
        if (localValue) return localValue
        
        // Check cookies as fallback (for server-side sessions)
        const cookies = document.cookie.split(';')
        for (let cookie of cookies) {
          const [cookieKey, cookieValue] = cookie.trim().split('=')
          if (cookieKey === key) {
            return decodeURIComponent(cookieValue)
          }
        }
        return null
      },
      setItem: (key: string, value: string) => {
        // Store in both localStorage and cookies for persistence
        window.localStorage.setItem(key, value)
        // Also set as non-httpOnly cookie so client can access
        document.cookie = `${key}=${encodeURIComponent(value)}; path=/; secure; samesite=lax; max-age=86400`
      },
      removeItem: (key: string) => {
        window.localStorage.removeItem(key)
        // Remove cookie too
        document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`
      }
    } : undefined,
    storageKey: `sb-${supabaseUrl.split('//')[1]?.split('.')[0]}-auth-token`,
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true
  }
})