'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthProvider'

export default function V2MigrationButton() {
  const { getAccessToken, isAuthenticated } = useAuth()
  const [status, setStatus] = useState<{
    needsMigration: number
    total: number
    checking: boolean
    migrating: boolean
    error?: string
    lastResult?: string
  }>({
    needsMigration: 0,
    total: 0,
    checking: true,
    migrating: false
  })

  const checkMigrationStatus = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) {
      setStatus(s => ({ ...s, checking: false }))
      return
    }

    setStatus(s => ({ ...s, checking: true, error: undefined }))
    try {
      const res = await fetch('/api/admin/migrate-v2', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()

      if (res.ok) {
        setStatus(s => ({
          ...s,
          needsMigration: data.needsMigration,
          total: data.total,
          checking: false
        }))
      } else {
        setStatus(s => ({ ...s, checking: false, error: data.error }))
      }
    } catch {
      setStatus(s => ({ ...s, checking: false, error: 'Failed to check status' }))
    }
  }, [getAccessToken])

  // Check migration status on mount
  useEffect(() => {
    if (isAuthenticated) {
      checkMigrationStatus()
    }
  }, [isAuthenticated, checkMigrationStatus])

  const runMigration = async () => {
    const token = await getAccessToken()
    if (!token) return

    setStatus(s => ({ ...s, migrating: true, error: undefined, lastResult: undefined }))
    try {
      const res = await fetch('/api/admin/migrate-v2', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batchSize: 5 })
      })
      const data = await res.json()

      if (res.ok) {
        setStatus(s => ({
          ...s,
          migrating: false,
          lastResult: `Migrated ${data.processed} notes. ${data.remaining} remaining.`
        }))
        // Refresh status
        await checkMigrationStatus()
      } else {
        setStatus(s => ({ ...s, migrating: false, error: data.error }))
      }
    } catch {
      setStatus(s => ({ ...s, migrating: false, error: 'Migration failed' }))
    }
  }

  // Don't show if checking or no notes need migration
  if (status.checking) {
    return null
  }

  if (status.needsMigration === 0 && !status.lastResult) {
    return null
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {status.needsMigration > 0 && (
        <>
          <span className="text-amber-600">
            {status.needsMigration} notes need V2
          </span>
          <button
            onClick={runMigration}
            disabled={status.migrating}
            className="px-2 py-1 bg-amber-500 text-white rounded text-xs hover:bg-amber-600 disabled:opacity-50"
          >
            {status.migrating ? 'Migrating...' : 'Migrate'}
          </button>
        </>
      )}
      {status.lastResult && (
        <span className="text-green-600">{status.lastResult}</span>
      )}
      {status.error && (
        <span className="text-red-600">{status.error}</span>
      )}
    </div>
  )
}
