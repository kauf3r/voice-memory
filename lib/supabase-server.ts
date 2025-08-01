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