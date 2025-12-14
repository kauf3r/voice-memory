'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'

export default function AutoAuth() {
  const { user } = useAuth()
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/auth/callback') {
      return
    }

    if (!user) {
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
          setMessage('Authentication error. Please try signing in again.')
        }
      })
    }
  }, [user])

  if (user || !message) return null

  return (
    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
      <p className="text-red-800">{message}</p>
    </div>
  )
}