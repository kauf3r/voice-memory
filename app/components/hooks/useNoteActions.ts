import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface UseNoteActionsProps {
  noteId: string
  onDelete?: (noteId: string) => void
  onRefresh?: () => void
}

export function useNoteActions({ noteId, onDelete, onRefresh }: UseNoteActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  const handleDelete = useCallback(async () => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return
    }

    setIsDeleting(true)
    try {
      // Get the current session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in.')
      }

      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete note')
      }

      onDelete?.(noteId)
    } catch (error) {
      console.error('Delete error:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete note')
    } finally {
      setIsDeleting(false)
    }
  }, [noteId, onDelete])

  const handleRetry = useCallback(async () => {
    if (!confirm('Retry processing this note?')) {
      return
    }

    setIsRetrying(true)
    try {
      // Get the current session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in.')
      }

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          noteId, 
          forceReprocess: true 
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to retry processing')
      }

      // Refresh the note data
      onRefresh?.()
    } catch (error) {
      console.error('Retry error:', error)
      alert(error instanceof Error ? error.message : 'Failed to retry processing')
    } finally {
      setIsRetrying(false)
    }
  }, [noteId, onRefresh])

  return {
    isDeleting,
    isRetrying,
    handleDelete,
    handleRetry,
  }
}