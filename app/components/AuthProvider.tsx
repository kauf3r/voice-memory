'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, processUrlTokens } from '@/lib/supabase'
import { AuthDebugger } from '@/lib/auth-debug'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
  getAccessToken: () => Promise<string | null>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithEmail: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
  getAccessToken: async () => null,
  isAuthenticated: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    AuthDebugger.log('Initializing auth...')
    AuthDebugger.debugUrl()
    
    let mounted = true
    
    // Enhanced auth initialization with manual token processing
    const initializeAuth = async () => {
      try {
        // First try to process any URL tokens manually
        const tokenResult = await processUrlTokens()
        
        if (!mounted) return // Component unmounted, don't update state
        
        if (tokenResult?.session) {
          AuthDebugger.success('Session set from URL tokens:', tokenResult.session.user.id)
          setUser(tokenResult.session.user)
          setLoading(false)
          return // Exit early since we have a session
        }
        
        if (tokenResult?.error) {
          AuthDebugger.error('Token processing failed:', tokenResult.error)
        }
        
        // If no URL tokens or token processing failed, check for existing session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return // Component unmounted, don't update state
        
        if (error) {
          AuthDebugger.error('Auth session error:', error)
          setUser(null)
        } else if (session?.user) {
          AuthDebugger.success('User session found:', session.user.id)
          AuthDebugger.debugSession(session)
          setUser(session.user)
        } else {
          AuthDebugger.info('No user session found')
          setUser(null)
        }
      } catch (error) {
        if (!mounted) return
        AuthDebugger.error('Auth initialization failed:', error)
        setUser(null)
      } finally {
        if (mounted) {
          AuthDebugger.log('Auth initialization complete')
          setLoading(false)
        }
      }
    }

    // Start initialization
    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      
      AuthDebugger.debugAuthState(event, session)
      setUser(session?.user ?? null)
      
      // Clean up URL on successful sign in
      if (event === 'SIGNED_IN' && typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
        AuthDebugger.log('Cleaning auth tokens from URL after sign in')
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
      }
      
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = async (email: string) => {
    try {
      AuthDebugger.log('Sending magic link to:', email)
      
      // Create timeout for the magic link request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Magic link request timeout')), 15000) // 15 second timeout
      })
      
      // Ensure we use the correct production URL for redirect
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://voice-memory-tau.vercel.app'
        : window.location.origin
      
      AuthDebugger.log('Using redirect URL:', `${baseUrl}/auth/callback`)
      
      // Send magic link with dedicated callback route
      const magicLinkPromise = supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${baseUrl}/auth/callback`,
          shouldCreateUser: true,
        },
      })
      
      const { error } = await Promise.race([magicLinkPromise, timeoutPromise]) as any
      
      if (error) {
        AuthDebugger.error('Magic link error:', error)
      } else {
        AuthDebugger.success('Magic link sent successfully')
      }
      
      return { error }
    } catch (error) {
      AuthDebugger.error('Magic link request failed:', error)
      return { error: error as Error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error) {
      return { error: error as Error }
    }
  }

  const getAccessToken = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      AuthDebugger.error('Failed to get access token:', error)
      return null
    }
  }

  const isAuthenticated = user !== null

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signOut, getAccessToken, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}