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

// Helper to get authenticated user from token in API routes
export async function getAuthenticatedUser(token: string) {
  console.log('🔐 Getting authenticated user with token length:', token?.length || 0)
  
  // Validate input
  if (!token || typeof token !== 'string') {
    console.error('❌ Invalid token provided')
    return { 
      user: null, 
      error: { message: 'Invalid token provided' } as any,
      client: null 
    }
  }
  
  // Check environment variables
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_KEY
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  console.log('🔧 Environment check:', {
    hasSupabaseUrl,
    hasServiceKey,
    hasAnonKey,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...'
  })
  
  if (!hasSupabaseUrl) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL')
    return { 
      user: null, 
      error: { message: 'Missing Supabase URL configuration' } as any,
      client: null 
    }
  }
  
  if (!hasServiceKey && !hasAnonKey) {
    console.error('❌ Missing both service key and anon key')
    return { 
      user: null, 
      error: { message: 'Missing Supabase key configuration' } as any,
      client: null 
    }
  }
  
  try {
    // If we have a service key, use it for direct authentication
    if (hasServiceKey) {
      console.log('📝 Using service key authentication')
      try {
        const serviceClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_KEY!
        )
        
        const { data: { user }, error } = await serviceClient.auth.getUser(token)
        console.log('🔍 Service auth result:', { hasUser: !!user, error: error?.message })
        
        if (error) {
          console.error('🚨 Service key auth failed:', error)
          // Don't return error immediately, fall back to anon key if available
          if (!hasAnonKey) {
            return { user: null, error, client: null }
          }
        } else if (user) {
          return { user, error: null, client: serviceClient }
        }
      } catch (serviceException) {
        console.error('🚨 Service key auth exception:', serviceException)
        // Fall through to anon key if available
        if (!hasAnonKey) {
          return { 
            user: null, 
            error: { message: `Service key auth failed: ${serviceException instanceof Error ? serviceException.message : 'Unknown error'}` } as any,
            client: null 
          }
        }
      }
    }
    
    // Use anon key with user token authentication
    if (hasAnonKey) {
      console.log('📝 Using anon key with user token authentication')
      try {
        const authenticatedClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          }
        )
        
        const { data: { user }, error } = await authenticatedClient.auth.getUser()
        console.log('🔍 Anon auth result:', { hasUser: !!user, error: error?.message })
        
        return { user, error, client: authenticatedClient }
      } catch (anonException) {
        console.error('🚨 Anon key auth exception:', anonException)
        return { 
          user: null, 
          error: { message: `Anon key auth failed: ${anonException instanceof Error ? anonException.message : 'Unknown error'}` } as any,
          client: null 
        }
      }
    }
    
    // This should never be reached
    console.error('❌ No authentication method available')
    return { 
      user: null, 
      error: { message: 'No authentication method available' } as any,
      client: null 
    }
    
  } catch (generalException) {
    console.error('❌ General exception in getAuthenticatedUser:', generalException)
    return { 
      user: null, 
      error: { message: `Authentication exception: ${generalException instanceof Error ? generalException.message : 'Unknown error'}` } as any,
      client: null 
    }
  }
}