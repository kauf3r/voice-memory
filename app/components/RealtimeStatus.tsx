'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthProvider'

interface RealtimeStatusProps {
  className?: string
  showLabel?: boolean
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export default function RealtimeStatus({ className = '', showLabel = true }: RealtimeStatusProps) {
  const { user } = useAuth()
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    if (!user) {
      setStatus('disconnected')
      return
    }

    setStatus('connecting')

    // Monitor Supabase realtime connection status
    const channel = supabase.channel('status_monitor')
    
    channel.subscribe((status) => {
      switch (status) {
        case 'SUBSCRIBED':
          setStatus('connected')
          setLastUpdate(new Date())
          break
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          setStatus('error')
          break
        case 'CLOSED':
          setStatus('disconnected')
          break
        default:
          setStatus('connecting')
      }
    })

    // Cleanup
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return '🟢'
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
    switch (status) {
      case 'connected':
        return 'Real-time active'
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
    switch (status) {
      case 'connected':
        return 'text-green-600'
      case 'connecting':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      case 'disconnected':
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div 
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
          status === 'connected' 
            ? 'bg-green-100 text-green-700' 
            : status === 'connecting'
            ? 'bg-yellow-100 text-yellow-700 animate-pulse'
            : status === 'error'
            ? 'bg-red-100 text-red-700'
            : 'bg-gray-100 text-gray-600'
        }`}
        title={`Real-time connection status: ${getStatusText()}${lastUpdate ? ` (Last update: ${lastUpdate.toLocaleTimeString()})` : ''}`}
      >
        <span className={status === 'connecting' ? 'animate-spin' : ''}>
          {getStatusIcon()}
        </span>
        {showLabel && (
          <span className={getStatusColor()}>
            {getStatusText()}
          </span>
        )}
      </div>
      
      {/* Pulse animation for active connection */}
      {status === 'connected' && (
        <div className="relative">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75"></div>
          <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full"></div>
        </div>
      )}
    </div>
  )
}