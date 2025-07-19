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
}

interface FetchNotesOptions {
  limit?: number
  search?: string
}

export function useNotes(options: FetchNotesOptions = {}): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

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
  }, [limit, search, offset])

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

  // Initial load and when search changes
  useEffect(() => {
    setLoading(true)
    setOffset(0)
    fetchNotes(true)
  }, [search]) // Only depend on search, not fetchNotes to avoid infinite loops

  return {
    notes,
    loading,
    error,
    totalCount,
    hasMore,
    refresh,
    loadMore,
  }
}