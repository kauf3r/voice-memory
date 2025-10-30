'use client'

import { useState, useCallback } from 'react'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export function useConnectionStatus() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')

  const updateStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status)
  }, [])

  const isConnected = connectionStatus === 'connected'
  const isConnecting = connectionStatus === 'connecting'
  const hasError = connectionStatus === 'error'
  const isDisconnected = connectionStatus === 'disconnected'

  return {
    connectionStatus,
    updateStatus,
    isConnected,
    isConnecting,
    hasError,
    isDisconnected
  }
}