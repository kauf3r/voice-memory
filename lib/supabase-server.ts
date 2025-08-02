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
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Fixed authentication helper using SERVICE_KEY for server-side operations
export async function getAuthenticatedUser(token: string) {
  console.log('🔐 Server-side auth validation starting')
  
  // Basic validation
  if (!token || typeof token !== 'string') {
    console.error('❌ Invalid token provided')
    return { 
      user: null, 
      error: { message: 'Invalid token' } as any,
      client: null 
    }
  }
  
  // Environment check - SERVICE_KEY is critical for server-side auth
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase SERVICE_KEY for server-side operations')
    return { 
      user: null, 
      error: { message: 'Server configuration error' } as any,
      client: null 
    }
  }
  
  try {
    console.log('🔧 Creating service client for JWT validation')
    
    // Use SERVICE_KEY for server-side operations - this is critical for RLS policy context
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY, // ← KEY FIX: Use service key, not anon key
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    console.log('🔍 Validating JWT token with service client')
    
    // Validate JWT token using service key - this establishes proper auth context
    const { data: { user }, error } = await serviceClient.auth.getUser(token)
    
    console.log('📊 Auth validation result:', {
      hasUser: !!user,
      userId: user?.id?.substring(0, 8) + '...',
      userEmail: user?.email,
      errorMessage: error?.message,
      errorStatus: error?.status
    })
    
    if (error) {
      console.error('🚨 JWT validation failed:', error.message)
      return { 
        user: null, 
        error: { message: `JWT validation failed: ${error.message}` } as any,
        client: null 
      }
    }
    
    if (!user) {
      console.error('⚠️ No user found in JWT token')
      return { 
        user: null, 
        error: { message: 'No user found in token' } as any,
        client: null 
      }
    }
    
    console.log('✅ Server-side authentication successful for:', user.email)
    
    // Return service client for database operations - bypasses RLS when needed
    return { user, error: null, client: serviceClient }
    
  } catch (error) {
    console.error('❌ Server-side auth exception:', error)
    return { 
      user: null, 
      error: { message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}` } as any,
      client: null 
    }
  }
}