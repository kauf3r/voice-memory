'use client'

import { useCallback, useRef } from 'react'
import { useAuth } from '@/app/components/AuthProvider'
import { supabase } from '@/lib/supabase'

export function useAuthToken() {
  const { user } = useAuth()
  const sessionCacheRef = useRef<{ session: any; timestamp: number } | null>(null)
  const SESSION_CACHE_DURATION = 30000 // 30 seconds cache

  const getAuthToken = useCallback(async () => {
    if (!user) {
      throw new Error('Authentication required')
    }
    
    const now = Date.now()
    const cached = sessionCacheRef.current
    
    // Use cached session if still valid
    if (cached && (now - cached.timestamp) < SESSION_CACHE_DURATION && cached.session?.access_token) {
      return cached.session.access_token
    }
    
    // Get fresh session
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
      throw new Error('Authentication session expired')
    }
    
    // Cache the session
    sessionCacheRef.current = { session, timestamp: now }
    return session.access_token
  }, [user])

  return { getAuthToken, user }
}