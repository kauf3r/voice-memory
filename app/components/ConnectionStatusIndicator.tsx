'use client'

import React from 'react'
import { usePinnedTasks } from './PinnedTasksProvider'

interface ConnectionStatusIndicatorProps {
  className?: string
  showLabel?: boolean
}

export function ConnectionStatusIndicator({ 
  className = '', 
  showLabel = false 
}: ConnectionStatusIndicatorProps) {
  const { connectionStatus, lastSyncTime, error } = usePinnedTasks()

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          color: 'bg-green-500',
          label: 'Connected',
          description: 'Real-time updates active',
          icon: '●'
        }
      case 'connecting':
        return {
          color: 'bg-yellow-500 animate-pulse',
          label: 'Connecting',
          description: 'Establishing connection...',
          icon: '◐'
        }
      case 'disconnected':
        return {
          color: 'bg-gray-400',
          label: 'Offline',
          description: 'Real-time updates paused',
          icon: '○'
        }
      case 'error':
        return {
          color: 'bg-red-500',
          label: 'Error',
          description: error || 'Connection error',
          icon: '✕'
        }
      default:
        return {
          color: 'bg-gray-400',
          label: 'Unknown',
          description: 'Status unknown',
          icon: '?'
        }
    }
  }

  const status = getStatusConfig()
  const lastSync = lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : null

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status indicator dot */}
      <div 
        className={`w-2 h-2 rounded-full ${status.color}`}
        title={status.description}
      />
      
      {/* Optional label and sync time */}
      {showLabel && (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700">
            {status.label}
          </span>
          {lastSync && connectionStatus === 'connected' && (
            <span className="text-xs text-gray-500">
              Last sync: {lastSync}
            </span>
          )}
          {error && connectionStatus === 'error' && (
            <span className="text-xs text-red-600 truncate max-w-40" title={error}>
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default ConnectionStatusIndicator