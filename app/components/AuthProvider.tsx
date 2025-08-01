'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithEmail: async () => ({ error: null }),
  signOut: async () => ({ error: null }),
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ensure consistent hook execution by not using async in useEffect directly
    console.log('🔑 Initializing auth...')
    
    let mounted = true
    
    // Initialize auth with consistent error handling
    const initializeAuth = async () => {
      try {
        // First check if we have tokens in the URL hash (from magic link)
        if (typeof window !== 'undefined' && window.location.hash) {
          console.log('🔍 Checking URL hash for auth tokens...')
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          
          if (accessToken && refreshToken) {
            console.log('✅ Found auth tokens in URL, setting session...')
            
            try {
              const { data, error: setSessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              })
              
              if (setSessionError) {
                console.error('❌ Failed to set session from tokens:', setSessionError)
              } else if (data?.session) {
                console.log('✅ Session set successfully from magic link:', data.session.user.id)
                setUser(data.session.user)
                
                // Clean up the URL to remove the tokens
                window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
                
                if (mounted) {
                  setLoading(false)
                }
                return // Exit early since we've set the session
              }
            } catch (tokenError) {
              console.error('❌ Error processing tokens:', tokenError)
            }
          }
        }
        
        // If no tokens in URL, check for existing session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return // Component unmounted, don't update state
        
        if (error) {
          console.warn('⚠️ Auth session error:', error.message)
          setUser(null)
        } else if (session?.user) {
          console.log('✅ User session found:', session.user.id)
          setUser(session.user)
        } else {
          console.log('ℹ️ No user session found')
          setUser(null)
        }
      } catch (error) {
        if (!mounted) return
        console.warn('⚠️ Auth initialization failed:', error.message)
        setUser(null)
      } finally {
        if (mounted) {
          console.log('🏁 Auth initialization complete')
          setLoading(false)
        }
      }
    }

    // Start initialization
    initializeAuth()

    // Listen for auth changes with consistent state updates  
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      
      console.log('🔔 Auth state change:', event, session?.user?.email || 'no user')
      setUser(session?.user ?? null)
      setLoading(false) // Always set loading to false on auth state changes
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = async (email: string) => {
    try {
      console.log('📧 Sending magic link to:', email)
      
      // Create timeout for the magic link request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Magic link request timeout')), 15000) // 15 second timeout
      })
      
      // Ensure we use the correct production URL for redirect
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://voice-memory-tau.vercel.app'
        : window.location.origin
      
      console.log('🌐 Using redirect URL:', `${baseUrl}/auth/callback`)
      
      // Try a simpler approach - let Supabase handle the redirect
      const magicLinkPromise = supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${baseUrl}/auth/callback`,
          shouldCreateUser: true,
          data: {
            email_confirmed: true
          }
        },
      })
      
      const { error } = await Promise.race([magicLinkPromise, timeoutPromise]) as any
      
      if (error) {
        console.error('❌ Magic link error:', error.message)
      } else {
        console.log('✅ Magic link sent successfully')
      }
      
      return { error }
    } catch (error) {
      console.error('❌ Magic link request failed:', error)
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

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signOut }}>
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