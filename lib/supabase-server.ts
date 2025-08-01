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
  console.log('🔐 Getting authenticated user with token length:', token.length)
  console.log('🔧 Environment check:', {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })
  
  try {
    // If we have a service key, use it for direct authentication
    if (process.env.SUPABASE_SERVICE_KEY) {
      console.log('📝 Using service key authentication')
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY
      )
      
      const { data: { user }, error } = await serviceClient.auth.getUser(token)
      console.log('🔍 Service auth result:', { hasUser: !!user, error: error?.message })
      return { user, error, client: serviceClient }
    }
    
    // Otherwise, create an authenticated client with the user's token
    console.log('📝 Using anon key with user token authentication')
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
  } catch (exception) {
    console.error('❌ Exception in getAuthenticatedUser:', exception)
    return { 
      user: null, 
      error: { message: `Authentication exception: ${exception instanceof Error ? exception.message : 'Unknown error'}` } as any,
      client: null 
    }
  }
}