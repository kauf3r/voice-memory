'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { ProcessingStats } from '@/lib/types'
import { useAuth } from '@/lib/hooks/use-auth'

type StatsScope = 'user' | 'global' | 'both'

interface ProcessingStatsData {
  user: ProcessingStats | null
  global: ProcessingStats | null
  both: ProcessingStats | null
}

interface ProcessingStatsState {
  data: ProcessingStatsData
  loading: {
    user: boolean
    global: boolean
    both: boolean
  }
  error: {
    user: string | null
    global: string | null
    both: string | null
  }
  lastUpdated: {
    user: Date | null
    global: Date | null
    both: Date | null
  }
}

interface ProcessingStatsContextValue extends ProcessingStatsState {
  refresh: (scope: StatsScope) => Promise<void>
  subscribe: (scope: StatsScope, enabled?: boolean, refreshInterval?: number) => void
  unsubscribe: (scope: StatsScope) => void
}

const ProcessingStatsContext = createContext<ProcessingStatsContextValue | undefined>(undefined)

interface ProcessingStatsProviderProps {
  children: React.ReactNode
}

interface Subscription {
  scope: StatsScope
  enabled: boolean
  refreshInterval: number
  count: number
}

export function ProcessingStatsProvider({ children }: ProcessingStatsProviderProps) {
  const { user, getAccessToken } = useAuth()
  
  const [state, setState] = useState<ProcessingStatsState>({
    data: { user: null, global: null, both: null },
    loading: { user: false, global: false, both: false },
    error: { user: null, global: null, both: null },
    lastUpdated: { user: null, global: null, both: null }
  })

  // Track subscriptions for each scope
  const subscriptions = useRef<Map<StatsScope, Subscription>>(new Map())
  const intervals = useRef<Map<StatsScope, NodeJS.Timeout>>(new Map())
  const abortControllers = useRef<Map<StatsScope, AbortController>>(new Map())

  const fetchStats = useCallback(async (scope: StatsScope, showLoading = true) => {
    if (!user) {
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, [scope]: false }
      }))
      return
    }

    try {
      if (showLoading) {
        setState(prev => ({
          ...prev,
          loading: { ...prev.loading, [scope]: true }
        }))
      }

      setState(prev => ({
        ...prev,
        error: { ...prev.error, [scope]: null }
      }))

      // Cancel any pending request for this scope
      const existingController = abortControllers.current.get(scope)
      if (existingController) {
        existingController.abort()
      }

      // Create new abort controller for this scope
      const controller = new AbortController()
      abortControllers.current.set(scope, controller)

      const token = await getAccessToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const url = new URL('/api/stats', window.location.origin)
      if (scope !== 'user') {
        url.searchParams.set('scope', scope)
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal
      })

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Insufficient permissions for requested metrics')
        } else if (response.status === 401) {
          throw new Error('Authentication required')
        } else {
          throw new Error(`Failed to fetch stats: ${response.statusText}`)
        }
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch processing stats')
      }

      // Remove the success field from the data
      const { success, ...statsData } = result
      
      setState(prev => ({
        ...prev,
        data: { ...prev.data, [scope]: statsData },
        lastUpdated: { ...prev.lastUpdated, [scope]: new Date() },
        error: { ...prev.error, [scope]: null }
      }))

    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was cancelled, don't update error state
        return
      }
      
      console.error(`Failed to fetch processing stats for ${scope}:`, err)
      setState(prev => ({
        ...prev,
        error: { ...prev.error, [scope]: err.message || 'Failed to fetch processing stats' }
      }))
    } finally {
      if (showLoading) {
        setState(prev => ({
          ...prev,
          loading: { ...prev.loading, [scope]: false }
        }))
      }
    }
  }, [user, getAccessToken])

  const refresh = useCallback(async (scope: StatsScope) => {
    await fetchStats(scope, true)
  }, [fetchStats])

  const subscribe = useCallback((scope: StatsScope, enabled = true, refreshInterval = scope === 'global' ? 10000 : 30000) => {
    const existing = subscriptions.current.get(scope)
    
    if (existing) {
      // Update existing subscription
      subscriptions.current.set(scope, {
        ...existing,
        enabled,
        refreshInterval,
        count: existing.count + 1
      })
    } else {
      // Create new subscription
      subscriptions.current.set(scope, {
        scope,
        enabled,
        refreshInterval,
        count: 1
      })
    }

    const subscription = subscriptions.current.get(scope)!

    // Only set up polling if enabled and not already active
    if (subscription.enabled && !intervals.current.has(scope)) {
      // Initial fetch
      fetchStats(scope, true)

      // Set up polling if refresh interval > 0
      if (subscription.refreshInterval > 0) {
        const interval = setInterval(() => {
          fetchStats(scope, false) // Don't show loading state for background refreshes
        }, subscription.refreshInterval)
        
        intervals.current.set(scope, interval)
      }
    }
  }, [fetchStats])

  const unsubscribe = useCallback((scope: StatsScope) => {
    const existing = subscriptions.current.get(scope)
    
    if (existing) {
      const newCount = existing.count - 1
      
      if (newCount <= 0) {
        // Remove subscription entirely
        subscriptions.current.delete(scope)
        
        // Clear interval
        const interval = intervals.current.get(scope)
        if (interval) {
          clearInterval(interval)
          intervals.current.delete(scope)
        }
        
        // Cancel any pending request
        const controller = abortControllers.current.get(scope)
        if (controller) {
          controller.abort()
          abortControllers.current.delete(scope)
        }
      } else {
        // Update count
        subscriptions.current.set(scope, {
          ...existing,
          count: newCount
        })
      }
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all intervals
      intervals.current.forEach((interval) => {
        clearInterval(interval)
      })
      intervals.current.clear()
      
      // Cancel all pending requests
      abortControllers.current.forEach((controller) => {
        controller.abort()
      })
      abortControllers.current.clear()
    }
  }, [])

  const contextValue: ProcessingStatsContextValue = {
    ...state,
    refresh,
    subscribe,
    unsubscribe
  }

  return (
    <ProcessingStatsContext.Provider value={contextValue}>
      {children}
    </ProcessingStatsContext.Provider>
  )
}

export function useProcessingStatsContext() {
  const context = useContext(ProcessingStatsContext)
  if (context === undefined) {
    throw new Error('useProcessingStatsContext must be used within a ProcessingStatsProvider')
  }
  return context
}