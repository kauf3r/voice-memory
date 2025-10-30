'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Note } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { createDebouncedHandler, createResilientSubscription, createUpdateMerger } from '@/lib/utils/realtime-subscriptions'

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
  clearAllErrors: () => Promise<void>
  filterByErrorStatus: (hasError: boolean | null) => void
  bulkRetryNotes: (noteIds: string[]) => Promise<void>
  getFilteredStats: () => {
    total: number
    withErrors: number
    processing: number
    completed: number
    pending: number
    failed: number
  }
  getErrorBreakdown: () => Record<string, number>
  bulkClearErrors: (noteIds: string[]) => Promise<void>
  retryByErrorType: (errorType: string) => Promise<void>
}

interface FetchNotesOptions {
  limit?: number
  search?: string
  errorStatus?: boolean | null // null = all, true = with errors, false = without errors
  includeErrorFields?: boolean
  enabled?: boolean // Whether the hook should run (default: true)
}

export function useNotes(options: FetchNotesOptions = {}): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const offsetRef = useRef(0)
  const [errorFilter, setErrorFilter] = useState<boolean | null>(options.errorStatus || null)

  const { limit = 20, search, includeErrorFields = true, enabled = true } = options
  
  // If disabled, return empty state
  if (!enabled) {
    return {
      notes: [],
      loading: false,
      error: null,
      totalCount: 0,
      hasMore: false,
      refresh: async () => {},
      loadMore: async () => {},
      retryNote: async () => {},
      retryFailedNotes: async () => {},
      clearAllErrors: async () => {},
      filterByErrorStatus: () => {},
      bulkRetryNotes: async () => {},
      getFilteredStats: () => ({ total: 0, withErrors: 0, processing: 0, completed: 0, pending: 0, failed: 0 }),
      getErrorBreakdown: () => ({}),
      bulkClearErrors: async () => {},
      retryByErrorType: async () => {},
    }
  }

  const fetchNotes = useCallback(async (resetOffset = true) => {
    try {
      setError(null)
      
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated - please log in')
      }
      
      const currentOffset = resetOffset ? 0 : offsetRef.current
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

      // Always include error fields for enhanced error handling
      if (includeErrorFields) {
        params.append('includeErrorFields', 'true')
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
        offsetRef.current = data.notes.length
      } else {
        setNotes(prev => [...prev, ...data.notes])
        offsetRef.current += data.notes.length
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
  }, [limit, search, errorFilter, includeErrorFields]) // Remove offset from dependencies to prevent infinite loops

  const refresh = useCallback(async () => {
    setLoading(true)
    offsetRef.current = 0
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
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to retry note processing')
      }

      // Update the note in the local state to show it's being retried
      setNotes(prev => prev.map(note => 
        note.id === noteId 
          ? { 
              ...note, 
              error_message: undefined, 
              last_error_at: undefined,
              processing_started_at: new Date().toISOString() 
            }
          : note
      ))

      // Refresh the notes to get updated status after a short delay
      setTimeout(() => refresh(), 1000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry note'
      setError(errorMessage)
      console.error('retryNote error:', err)
      throw err // Re-throw for component error handling
    }
  }, [refresh])

  const retryFailedNotes = useCallback(async () => {
    try {
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated - please log in')
      }

      // Get failed notes from current state
      const failedNotes = notes.filter(note => note.error_message)

      if (failedNotes.length === 0) {
        return
      }

      console.log(`Retrying ${failedNotes.length} failed notes`)

      // Retry each failed note in parallel (with rate limiting)
      const retryPromises = failedNotes.map((note, index) => 
        new Promise<{ noteId: string; success: boolean; error?: string }>((resolve) => {
          setTimeout(async () => {
            try {
              const response = await fetch('/api/process', {
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
              
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                resolve({ noteId: note.id, success: false, error: errorData.error })
              } else {
                resolve({ noteId: note.id, success: true })
              }
            } catch (err) {
              resolve({ noteId: note.id, success: false, error: err instanceof Error ? err.message : 'Unknown error' })
            }
          }, index * 500) // Stagger requests by 500ms
        })
      )

      const results = await Promise.allSettled(retryPromises)
      const successfulRetries = results
        .filter((result): result is PromiseFulfilledResult<{ noteId: string; success: boolean }> => 
          result.status === 'fulfilled' && result.value.success)
        .map(result => result.value.noteId)

      // Update local state to show notes are being retried
      setNotes(prev => prev.map(note => 
        successfulRetries.includes(note.id)
          ? { 
              ...note, 
              error_message: undefined, 
              last_error_at: undefined,
              processing_started_at: new Date().toISOString() 
            }
          : note
      ))

      console.log(`Successfully initiated retry for ${successfulRetries.length}/${failedNotes.length} notes`)

      // Refresh the notes to get updated status
      setTimeout(() => refresh(), 2000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry failed notes'
      setError(errorMessage)
      console.error('retryFailedNotes error:', err)
    }
  }, [notes, refresh])

  const clearAllErrors = useCallback(async () => {
    try {
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated - please log in')
      }

      // Get failed notes from current state
      const failedNotes = notes.filter(note => note.error_message)

      if (failedNotes.length === 0) {
        return
      }

      // Clear errors from all failed notes in the database
      const { error: updateError } = await supabase
        .from('notes')
        .update({ 
          error_message: null, 
          last_error_at: null 
        })
        .in('id', failedNotes.map(note => note.id))

      if (updateError) {
        throw new Error(`Failed to clear errors: ${updateError.message}`)
      }

      // Update local state
      setNotes(prev => prev.map(note => 
        failedNotes.some(failed => failed.id === note.id)
          ? { ...note, error_message: undefined, last_error_at: undefined }
          : note
      ))

      console.log(`Cleared errors for ${failedNotes.length} notes`)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear errors'
      setError(errorMessage)
      console.error('clearAllErrors error:', err)
    }
  }, [notes])

  const bulkRetryNotes = useCallback(async (noteIds: string[]) => {
    try {
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated - please log in')
      }

      if (noteIds.length === 0) {
        return
      }

      console.log(`Bulk retrying ${noteIds.length} notes`)

      // Retry selected notes in parallel (with rate limiting)
      const retryPromises = noteIds.map((noteId, index) => 
        new Promise<{ noteId: string; success: boolean }>((resolve) => {
          setTimeout(async () => {
            try {
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
              resolve({ noteId, success: response.ok })
            } catch (err) {
              resolve({ noteId, success: false })
            }
          }, index * 300) // Stagger requests by 300ms
        })
      )

      const results = await Promise.allSettled(retryPromises)
      const successfulRetries = results
        .filter((result): result is PromiseFulfilledResult<{ noteId: string; success: boolean }> => 
          result.status === 'fulfilled' && result.value.success)
        .map(result => result.value.noteId)

      // Update local state to show notes are being retried
      setNotes(prev => prev.map(note => 
        successfulRetries.includes(note.id)
          ? { 
              ...note, 
              error_message: undefined, 
              last_error_at: undefined,
              processing_started_at: new Date().toISOString() 
            }
          : note
      ))

      console.log(`Successfully initiated retry for ${successfulRetries.length}/${noteIds.length} notes`)

      // Refresh the notes to get updated status
      setTimeout(() => refresh(), 1500)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry selected notes'
      setError(errorMessage)
      console.error('bulkRetryNotes error:', err)
    }
  }, [refresh])

  const bulkClearErrors = useCallback(async (noteIds: string[]) => {
    try {
      if (noteIds.length === 0) return

      // Clear errors from specified notes in the database
      const { error: updateError } = await supabase
        .from('notes')
        .update({ 
          error_message: null, 
          last_error_at: null 
        })
        .in('id', noteIds)

      if (updateError) {
        throw new Error(`Failed to clear errors: ${updateError.message}`)
      }

      // Update local state
      setNotes(prev => prev.map(note => 
        noteIds.includes(note.id)
          ? { ...note, error_message: undefined, last_error_at: undefined }
          : note
      ))

      console.log(`Cleared errors for ${noteIds.length} notes`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear errors'
      setError(errorMessage)
      console.error('bulkClearErrors error:', err)
    }
  }, [])

  const retryByErrorType = useCallback(async (errorType: string) => {
    try {
      // Filter notes by error type (simple keyword matching)
      const notesToRetry = notes
        .filter(note => note.error_message && note.error_message.toLowerCase().includes(errorType.toLowerCase()))
        .map(note => note.id)

      if (notesToRetry.length === 0) {
        console.log(`No notes found with error type: ${errorType}`)
        return
      }

      console.log(`Retrying ${notesToRetry.length} notes with error type: ${errorType}`)
      await bulkRetryNotes(notesToRetry)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry notes by error type'
      setError(errorMessage)
      console.error('retryByErrorType error:', err)
    }
  }, [notes, bulkRetryNotes])

  const filterByErrorStatus = useCallback((hasError: boolean | null) => {
    setErrorFilter(hasError)
    offsetRef.current = 0
    setLoading(true)
  }, [])

  const getFilteredStats = useCallback(() => {
    const total = notes.length
    const withErrors = notes.filter(note => note.error_message).length
    const processing = notes.filter(note => note.processing_started_at && !note.processed_at).length
    const completed = notes.filter(note => note.transcription && note.analysis).length
    const pending = notes.filter(note => !note.transcription && !note.error_message && !note.processing_started_at).length
    const failed = withErrors // Same as withErrors

    return {
      total,
      withErrors,
      processing,
      completed,
      pending,
      failed
    }
  }, [notes])

  const getErrorBreakdown = useCallback((): Record<string, number> => {
    const errorBreakdown: Record<string, number> = {}
    
    notes.forEach(note => {
      if (note.error_message) {
        const message = note.error_message.toLowerCase()
        let category = 'unknown'
        
        if (message.includes('timeout')) {
          category = 'timeout'
        } else if (message.includes('rate limit') || message.includes('too many requests')) {
          category = 'rate_limit'
        } else if (message.includes('network') || message.includes('connection')) {
          category = 'network'
        } else if (message.includes('openai') || message.includes('api')) {
          category = 'api_error'
        } else if (message.includes('validation') || message.includes('invalid')) {
          category = 'validation'
        } else if (message.includes('storage') || message.includes('file')) {
          category = 'storage'
        } else if (message.includes('authentication') || message.includes('authorization')) {
          category = 'auth'
        } else if (message.includes('circuit breaker')) {
          category = 'circuit_breaker'
        }
        
        errorBreakdown[category] = (errorBreakdown[category] || 0) + 1
      }
    })
    
    return errorBreakdown
  }, [notes])

  // Enhanced real-time updates using Supabase subscriptions with debouncing
  useEffect(() => {
    if (!enabled || !notes.length) return

    // Create update merger to consolidate multiple updates for the same note
    const updateMerger = createUpdateMerger<Note>()
    
    // Create debounced handler to batch updates
    const { handler: debouncedUpdate, cleanup } = createDebouncedHandler<Note>(
      (updates) => {
        console.log(`Processing ${updates.length} real-time note updates`)
        
        setNotes(prev => {
          const updateMap = new Map(updates.map(update => [update.id, update]))
          
          return prev.map(note => {
            const update = updateMap.get(note.id)
            return update ? { ...note, ...update } : note
          })
        })
      },
      {
        debounceMs: 500, // Wait 500ms before processing updates
        maxBatchSize: 20, // Process max 20 updates at once
        onError: (error) => {
          console.error('Error processing real-time updates:', error)
          setError(`Real-time sync error: ${error.message}`)
        }
      }
    )

    // Create channel with unique name to avoid conflicts
    const channelName = `notes_changes_${Date.now()}`
    const channel = supabase.channel(channelName)
    
    // Subscribe to changes for current notes only
    const noteIds = notes.map(n => n.id)
    
    channel.on('postgres_changes', 
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'notes',
        // Use a more efficient filter for note IDs
        filter: noteIds.length <= 10 
          ? `id=in.(${noteIds.join(',')})` 
          : undefined // For large lists, filter client-side instead
      }, 
      (payload) => {
        // Client-side filter for large note lists
        if (noteIds.length > 10 && !noteIds.includes(payload.new.id)) {
          return
        }
        
        console.log('Real-time note update received:', payload.new.id)
        debouncedUpdate(payload.new as Note)
      }
    )

    // Create resilient subscription with auto-reconnect
    const unsubscribe = createResilientSubscription(channel, {
      maxRetries: 3,
      retryDelay: 2000,
      onConnect: () => console.log('✅ Notes real-time subscription connected'),
      onDisconnect: () => console.log('❌ Notes real-time subscription disconnected'),
      onError: (error) => {
        console.error('Notes subscription error:', error)
        setError(`Real-time connection lost: ${error.message}`)
      }
    })

    return () => {
      cleanup() // Flush any pending updates
      unsubscribe() // Unsubscribe from channel
    }
  }, [notes.length]) // Only re-subscribe when number of notes changes, not on every update

  // Initial load and when search or error filter changes
  useEffect(() => {
    if (!enabled) return // Don't fetch if disabled
    
    setLoading(true)
    offsetRef.current = 0
    fetchNotes(true)
  }, [search, errorFilter, enabled, fetchNotes])

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
    clearAllErrors,
    filterByErrorStatus,
    bulkRetryNotes,
    getFilteredStats,
    getErrorBreakdown,
    bulkClearErrors,
    retryByErrorType,
  }
}