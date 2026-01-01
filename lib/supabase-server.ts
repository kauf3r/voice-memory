import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Legacy support for service client
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

// Legacy support - deprecated, use createServerSupabaseClient instead
export async function createServerClient() {
  const cookieStore = await cookies()

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Authenticate user from Bearer token
// Returns an authenticated client that can be used for RLS-protected operations
export async function getAuthenticatedUser(token: string) {
  try {
    if (!token) {
      return { user: null, error: new Error('No token provided'), client: null }
    }

    // Create a client with the token in the Authorization header
    // This ensures all subsequent requests (including storage) use this token for RLS
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const { data: { user }, error } = await client.auth.getUser(token)

    if (error || !user) {
      return { user: null, error: error || new Error('User not found'), client: null }
    }

    return { user, error: null, client }
  } catch (error) {
    return { user: null, error: error as Error, client: null }
  }
}

/**
 * Authenticate a request using Bearer token or cookies
 * Returns the authenticated user and a properly configured Supabase client
 *
 * This is the preferred method for API routes - it handles:
 * 1. Bearer token authentication (Authorization header)
 * 2. Cookie-based authentication (fallback)
 * 3. Returns a client configured for RLS-protected operations
 */
export async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')

  // Try Bearer token first
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { user, error, client } = await getAuthenticatedUser(token)

    if (user && client) {
      return { user, error: null, client }
    }
    // If Bearer token failed, fall through to cookie auth
  }

  // Fallback to cookie-based auth
  const cookieClient = await createServerSupabaseClient()
  const { data: { user }, error } = await cookieClient.auth.getUser()

  return { user, error, client: cookieClient }
}