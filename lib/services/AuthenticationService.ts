/**
 * Authentication Service for Knowledge API
 * Handles both service key and anon key authentication approaches
 */

import { createClient } from '@supabase/supabase-js'
import { AuthenticationContext } from './KnowledgeTypes'

export class AuthenticationService {
  /**
   * Authenticate user from Authorization header with dual auth support
   */
  static async authenticateFromHeader(authHeader: string | null): Promise<AuthenticationContext> {
    console.log('🔐 AuthenticationService - authenticating user')
    console.log('📋 Auth header analysis:', {
      present: !!authHeader,
      startsWithBearer: authHeader?.startsWith('Bearer '),
      length: authHeader?.length || 0
    })
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Authorization header required')
    }

    const token = authHeader.split(' ')[1]
    console.log('🎟️ Token analysis:', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 20) + '...',
      tokenEnd: '...' + token.substring(token.length - 20)
    })

    // Check if service key exists, if not use anon key with RLS
    if (!process.env.SUPABASE_SERVICE_KEY) {
      console.warn('⚠️ SUPABASE_SERVICE_KEY not found, using anon key with RLS')
    }

    // Create service client for authentication - fallback to anon key if service key not available
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    console.log('🔐 Attempting to validate token...')

    let user = null
    let authError = null
    let authMethod: 'service' | 'anon' = 'service'

    if (process.env.SUPABASE_SERVICE_KEY) {
      // If we have a service key, use it to validate the token
      const { data: { user: serviceUser }, error: serviceError } = await supabase.auth.getUser(token)
      user = serviceUser
      authError = serviceError
      authMethod = 'service'
    } else {
      // If using anon key, create a new client with the user's token
      console.log('📝 Using anon key - creating authenticated client')
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
      
      const { data: { user: anonUser }, error: anonError } = await authenticatedClient.auth.getUser()
      user = anonUser
      authError = anonError
      authMethod = 'anon'
    }

    if (authError || !user) {
      console.error('❌ Authentication failed:', {
        error: authError,
        hasUser: !!user,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
      })
      throw new Error('Invalid authentication token')
    }

    console.log('✅ User authenticated:', {
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      authMethod
    })

    // Create database client based on auth method
    const dbClient = this.createDatabaseClient(token, authMethod)

    return {
      user,
      token,
      dbClient,
      authMethod
    }
  }

  /**
   * Create appropriate database client based on authentication method
   */
  private static createDatabaseClient(token: string, authMethod: 'service' | 'anon') {
    if (authMethod === 'service') {
      // Use service key client
      return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      )
    } else {
      // Use authenticated anon key client
      return createClient(
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
    }
  }

  /**
   * Alternative authentication for PUT requests using cookies fallback
   */
  static async authenticateWithFallback(authHeader: string | null, cookieClient: any): Promise<AuthenticationContext> {
    // Try header authentication first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        return await this.authenticateFromHeader(authHeader)
      } catch (error) {
        console.warn('Header authentication failed, trying cookies:', error)
      }
    }

    // Fall back to cookie authentication
    const { data, error: cookieError } = await cookieClient.auth.getUser()
    if (cookieError || !data?.user) {
      throw new Error('Unauthorized')
    }

    console.log('✅ User authenticated via cookies:', {
      userId: data.user.id,
      userEmail: data.user.email
    })

    return {
      user: data.user,
      token: '', // No token available from cookies
      dbClient: cookieClient,
      authMethod: 'anon'
    }
  }
}