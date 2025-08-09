'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'

interface RealtimeStatusProps {
  className?: string
  showLabel?: boolean
  connectionStatus?: 'connecting' | 'connected' | 'disconnected' | 'error'
  connectionMode?: 'websocket' | 'polling' | 'unknown'
  onRetry?: () => void
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'
type ConnectionMode = 'websocket' | 'polling' | 'unknown'

export default function RealtimeStatus({ 
  className = '', 
  showLabel = true,
  connectionStatus,
  connectionMode = 'unknown',
  onRetry 
}: RealtimeStatusProps) {
  const { user } = useAuth()
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [mode, setMode] = useState<ConnectionMode>('unknown')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Use provided status if available, otherwise default behavior
  const currentStatus = connectionStatus || status
  const currentMode = connectionMode

  useEffect(() => {
    if (!user) {
      setStatus('disconnected')
      return
    }

    // If no external status provided, set default
    if (!connectionStatus) {
      setStatus('connecting')
    }
  }, [user, connectionStatus])

  // Update last update time when status changes to connected
  useEffect(() => {
    if (currentStatus === 'connected') {
      setLastUpdate(new Date())
    }
  }, [currentStatus])

  const getStatusIcon = () => {
    switch (currentStatus) {
      case 'connected':
        return currentMode === 'polling' ? '📊' : '🟢' // Use different icon for polling
      case 'connecting':
        return '🟡'
      case 'error':
        return '🔴'
      case 'disconnected':
      default:
        return '⚫'
    }
  }

  const getStatusText = () => {
    switch (currentStatus) {
      case 'connected':
        return currentMode === 'polling' ? 'Backup mode' : 'Real-time active'
      case 'connecting':
        return 'Connecting...'
      case 'error':
        return 'Connection error'
      case 'disconnected':
      default:
        return 'Real-time off'
    }
  }

  const getStatusColor = () => {
    switch (currentStatus) {
      case 'connected':
        return currentMode === 'polling' ? 'text-blue-600' : 'text-green-600'
      case 'connecting':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      case 'disconnected':
      default:
        return 'text-gray-500'
    }
  }

  const getBackgroundColor = () => {
    switch (currentStatus) {
      case 'connected':
        return currentMode === 'polling' 
          ? 'bg-blue-100 text-blue-700' 
          : 'bg-green-100 text-green-700'
      case 'connecting':
        return 'bg-yellow-100 text-yellow-700 animate-pulse'
      case 'error':
        return 'bg-red-100 text-red-700'
      case 'disconnected':
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const getModeTooltip = () => {
    switch (currentMode) {
      case 'websocket':
        return 'WebSocket real-time connection'
      case 'polling':
        return 'HTTP polling backup mode (updates every 5 seconds)'
      default:
        return 'Connection mode unknown'
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all duration-300 ${getBackgroundColor()}`}
        title={`${getModeTooltip()}. Status: ${getStatusText()}${lastUpdate ? ` (Last update: ${lastUpdate.toLocaleTimeString()})` : ''}`}
      >
        <span className={currentStatus === 'connecting' ? 'animate-spin' : ''}>
          {getStatusIcon()}
        </span>
        {showLabel && (
          <span className={getStatusColor()}>
            {getStatusText()}
          </span>
        )}
        {currentMode === 'polling' && currentStatus === 'connected' && (
          <span className="text-xs opacity-75 ml-1">
            (5s)
          </span>
        )}
      </div>
      
      {/* Pulse animation for active WebSocket connection */}
      {currentStatus === 'connected' && currentMode === 'websocket' && (
        <div className="relative">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75"></div>
          <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
      )}
      
      {/* Retry button for error state */}
      {currentStatus === 'error' && onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          title="Retry connection"
        >
          Retry
        </button>
      )}
    </div>
  )
}