'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/app/components/AuthProvider'
import { supabase } from '@/lib/supabase'

interface UseNoteActionsProps {
  noteId: string
  onDelete?: (noteId: string) => void
  onRefresh?: () => void
}

export function useNoteActions({ noteId, onDelete, onRefresh }: UseNoteActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const { user } = useAuth()

  const handleDelete = useCallback(async () => {
    if (!user || isDeleting) return

    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', user.id)

      if (error) throw error

      onDelete?.(noteId)
      onRefresh?.()
    } catch (error) {
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(false)
    }
  }, [user, noteId, onDelete, onRefresh, isDeleting])

  const handleRetry = useCallback(async () => {
    if (!user || isRetrying) return
    
    setIsRetrying(true)
    try {
      await processNote()
      onRefresh?.()
    } catch (error) {
      console.error('Retry error:', error)
    } finally {
      setIsRetrying(false)
    }
  }, [user, isRetrying, onRefresh])

  const handleProcessNow = useCallback(async () => {
    if (!user || isProcessing) return
    
    setIsProcessing(true)
    try {
      await processNote()
      onRefresh?.()
    } catch (error) {
      console.error('Process now error:', error)
    } finally {
      setIsProcessing(false)
    }
  }, [user, isProcessing, onRefresh])

  const processNote = useCallback(async () => {
    if (!user) throw new Error('User not authenticated')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('No active session')

    const response = await fetch('/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        noteId: noteId,
        forceReprocess: false
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Processing failed' }))
      throw new Error(errorData.error || 'Processing failed')
    }

    return response.json()
  }, [user, noteId])

  return {
    isDeleting,
    isRetrying,
    isProcessing,
    handleDelete,
    handleRetry,
    handleProcessNow
  }
}