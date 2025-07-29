'use client'

import { useCallback, useEffect } from 'react'
import { ProcessingStats } from '@/lib/types'
import { useProcessingStatsContext } from '@/lib/contexts/ProcessingStatsContext'

type StatsScope = 'user' | 'global' | 'both'

interface UseProcessingStatsOptions {
  scope?: StatsScope
  refreshInterval?: number
  enabled?: boolean
}

interface UseProcessingStatsReturn {
  data: ProcessingStats | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  lastUpdated: Date | null
}

export function useProcessingStats(options: UseProcessingStatsOptions = {}): UseProcessingStatsReturn {
  const {
    scope = 'user',
    refreshInterval = scope === 'global' ? 10000 : 30000, // 10s for global, 30s for user
    enabled = true
  } = options

  const context = useProcessingStatsContext()

  // Subscribe to the scope when the hook is used
  useEffect(() => {
    if (enabled) {
      context.subscribe(scope, enabled, refreshInterval)
    }

    // Unsubscribe when the hook is unmounted or disabled
    return () => {
      context.unsubscribe(scope)
    }
  }, [scope, enabled, refreshInterval, context.subscribe, context.unsubscribe])

  const refresh = useCallback(async () => {
    await context.refresh(scope)
  }, [context.refresh, scope])

  return {
    data: context.data[scope],
    loading: context.loading[scope],
    error: context.error[scope],
    refresh,
    lastUpdated: context.lastUpdated[scope]
  }
}