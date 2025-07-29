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
    // Enhanced session restoration with timeout
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...')
        
        // First, try to get session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.warn('Auth session error:', error)
        }
        
        if (session?.user) {
          console.log('User session found:', session.user.id)
          setUser(session.user)
        } else {
          console.log('No user session found')
          
          // If no session, try to refresh from storage
          console.log('Attempting to refresh session...')
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          
          if (refreshError) {
            console.log('Session refresh failed:', refreshError.message)
          } else if (refreshData?.session?.user) {
            console.log('Session refreshed successfully:', refreshData.session.user.id)
            setUser(refreshData.session.user)
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        // Still set loading to false even on error
      } finally {
        console.log('Auth initialization complete')
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
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