'use client'

import { useState, useEffect, useCallback } from 'react'
import { Note } from '@/lib/types'
import { supabase } from '@/lib/supabase'

interface UseNotesReturn {
  notes: Note[]
  loading: boolean
  error: string | null
  totalCount: number
  hasMore: boolean
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  retryNote: (noteId: string) => Promise<void>
  retryFailedNotes: () => Promise<void>
  filterByErrorStatus: (hasError: boolean) => void
}

interface FetchNotesOptions {
  limit?: number
  search?: string
  errorStatus?: boolean | null // null = all, true = with errors, false = without errors
}

export function useNotes(options: FetchNotesOptions = {}): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [errorFilter, setErrorFilter] = useState<boolean | null>(options.errorStatus || null)

  const { limit = 20, search } = options

  const fetchNotes = useCallback(async (resetOffset = true) => {
    try {
      setError(null)
      
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated - please log in')
      }
      
      const currentOffset = resetOffset ? 0 : offset
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: currentOffset.toString(),
      })
      
      if (search) {
        params.append('search', search)
      }

      // Add error status filter
      if (errorFilter !== null) {
        params.append('errorStatus', errorFilter.toString())
      }

      const response = await fetch(`/api/notes?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired - please log in again')
        }
        throw new Error(`Failed to fetch notes (${response.status})`)
      }

      const data = await response.json()
      
      if (resetOffset) {
        setNotes(data.notes)
        setOffset(data.notes.length)
      } else {
        setNotes(prev => [...prev, ...data.notes])
        setOffset(prev => prev + data.notes.length)
      }
      
      setTotalCount(data.pagination.total)
      setHasMore(data.pagination.hasMore)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch notes'
      setError(errorMessage)
      console.error('useNotes error:', err)
    } finally {
      setLoading(false)
    }
  }, [limit, search, offset, errorFilter])

  const refresh = useCallback(async () => {
    setLoading(true)
    setOffset(0)
    await fetchNotes(true)
  }, [fetchNotes])

  const loadMore = useCallback(async () => {
    if (hasMore && !loading) {
      await fetchNotes(false)
    }
  }, [fetchNotes, hasMore, loading])

  const retryNote = useCallback(async (noteId: string) => {
    try {
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated - please log in')
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
        throw new Error('Failed to retry note processing')
      }

      // Refresh the notes to get updated status
      await refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry note'
      setError(errorMessage)
      console.error('retryNote error:', err)
    }
  }, [refresh])

  const retryFailedNotes = useCallback(async () => {
    try {
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated - please log in')
      }

      // Get failed notes
      const { data: failedNotes } = await supabase
        .from('notes')
        .select('id')
        .not('error_message', 'is', null)

      if (failedNotes && failedNotes.length > 0) {
        // Retry each failed note
        for (const note of failedNotes) {
          await fetch('/api/process', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              noteId: note.id, 
              forceReprocess: true 
            }),
          })
        }
      }

      // Refresh the notes to get updated status
      await refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry failed notes'
      setError(errorMessage)
      console.error('retryFailedNotes error:', err)
    }
  }, [refresh])

  const filterByErrorStatus = useCallback((hasError: boolean | null) => {
    setErrorFilter(hasError)
    setOffset(0)
    setLoading(true)
  }, [])

  // Initial load and when search or error filter changes
  useEffect(() => {
    setLoading(true)
    setOffset(0)
    fetchNotes(true)
  }, [search, errorFilter]) // Include errorFilter in dependencies

  return {
    notes,
    loading,
    error,
    totalCount,
    hasMore,
    refresh,
    loadMore,
    retryNote,
    retryFailedNotes,
    filterByErrorStatus,
  }
}