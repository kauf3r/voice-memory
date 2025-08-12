import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export function createServerClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables')
  }

  let cookieStore: any = null
  
  try {
    // Try to get cookies, but handle if it fails in certain environments
    cookieStore = cookies()
  } catch (error) {
    console.log('Unable to access cookies in this environment:', error)
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim(),
    {
      auth: {
        storageKey: 'voice-memory-server-auth-token', // Unique storage key for server
        storage: cookieStore ? {
          getItem: (key: string) => {
            try {
              // Try multiple possible cookie names
              const possibleNames = [
                key,
                `sb-${key}`,
                `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-${key}`,
              ]
              
              for (const name of possibleNames) {
                const cookie = cookieStore.get(name)
                if (cookie?.value) {
                  console.log(`Found auth cookie: ${name}`)
                  return cookie.value
                }
              }
              
              return null
            } catch (error) {
              console.log('Error accessing cookie:', error)
              return null
            }
          },
          setItem: () => {
            // Server-side doesn't set cookies
          },
          removeItem: () => {
            // Server-side doesn't remove cookies
          },
        } : undefined,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
      realtime: {
        // Disable realtime for server-side clients
        params: {},
      },
      global: {
        headers: {
          'X-Client-Info': 'voice-memory-server',
        },
      },
    }
  )
}

export function createServiceClient() {
  // Check if service key exists, if not fall back to anon key
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!serviceKey) {
    throw new Error('No Supabase keys available')
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    serviceKey.trim(),
    {
      auth: {
        storageKey: 'voice-memory-service-auth-token', // Unique storage key for service
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        // Disable realtime for service clients
        params: {},
      },
      global: {
        headers: {
          'X-Client-Info': 'voice-memory-service',
        },
      },
    }
  )
}

// Legacy authentication helper using SERVICE_KEY (DEPRECATED - use getUserScopedClient instead)
export async function getAuthenticatedUser(token: string) {
  console.log('⚠️ Using deprecated getAuthenticatedUser - migrate to getUserScopedClient')
  return getUserScopedClient(token)
}

// User-scoped authentication helper (replaces SERVICE_KEY approach)
export async function getUserScopedClient(token: string) {
  console.log('🔐 Creating user-scoped client')
  
  // Basic validation
  if (!token || typeof token !== 'string') {
    console.error('❌ Invalid token provided')
    return { 
      user: null, 
      error: { message: 'Invalid token' } as any,
      client: null 
    }
  }
  
  // Environment check
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase environment variables')
    return { 
      user: null, 
      error: { message: 'Server configuration error' } as any,
      client: null 
    }
  }
  
  try {
    // Create user-scoped client with the provided token
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )
    
    console.log('🔍 Validating user with user-scoped client')
    
    // Validate user through user-scoped client (respects RLS)
    const { data: { user }, error } = await userClient.auth.getUser()
    
    console.log('📊 Auth validation result:', {
      hasUser: !!user,
      userId: user?.id?.substring(0, 8) + '...',
      userEmail: user?.email,
      errorMessage: error?.message
    })
    
    if (error) {
      console.error('🚨 User validation failed:', error.message)
      return { 
        user: null, 
        error: { message: `User validation failed: ${error.message}` } as any,
        client: null 
      }
    }
    
    if (!user) {
      console.error('⚠️ No user found in token')
      return { 
        user: null, 
        error: { message: 'No user found in token' } as any,
        client: null 
      }
    }
    
    console.log('✅ User-scoped authentication successful for:', user.email)
    
    // Return user-scoped client - respects RLS policies
    return { user, error: null, client: userClient }
    
  } catch (error) {
    console.error('❌ Server-side auth exception:', error)
    return { 
      user: null, 
      error: { message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}` } as any,
      client: null 
    }
  }
}