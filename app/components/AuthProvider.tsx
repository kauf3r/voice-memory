'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, processUrlTokens } from '@/lib/supabase'

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
    // Check for auth errors in URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const error = urlParams.get('error')
      const details = urlParams.get('details')

      if (error && error.trim()) {
        console.error('Auth error from URL:', { error, details })
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    }

    let mounted = true

    const initializeAuth = async () => {
      try {
        // First try to process any URL tokens
        const tokenResult = await processUrlTokens()

        if (!mounted) return

        if (tokenResult?.session) {
          setUser(tokenResult.session.user)
          setLoading(false)
          return
        }

        // Check for existing session
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          console.error('Auth session error:', error)
          setUser(null)
        } else if (session?.user) {
          setUser(session.user)
        } else {
          setUser(null)
        }
      } catch (error) {
        if (!mounted) return
        console.error('Auth initialization failed:', error)
        setUser(null)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      setUser(session?.user ?? null)

      // Clean up URL on successful sign in
      if (event === 'SIGNED_IN' && typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
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
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Magic link request timeout')), 15000)
      })

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
                      (typeof window !== 'undefined' ? window.location.origin :
                      `https://${process.env.VERCEL_URL}`)

      const magicLinkPromise = supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${baseUrl}/auth/callback`,
          shouldCreateUser: true,
        },
      })

      const { error } = await Promise.race([magicLinkPromise, timeoutPromise]) as any

      return { error }
    } catch (error) {
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
      console.error('Failed to get access token:', error)
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