'use client'

import { useMemo } from 'react'
import { Note } from '@/lib/types'

export function useNoteStatus(note: Note) {
  const status = useMemo(() => {
    const hasError = !!note.error_message
    const isProcessing = !!note.processing_started_at && !note.processed_at && !hasError
    const processingAttempts = note.processing_attempts || 0
    
    let errorSeverity: 'low' | 'medium' | 'high' = 'low'
    if (processingAttempts > 2) errorSeverity = 'high'
    else if (processingAttempts > 1) errorSeverity = 'medium'

    let iconType = 'status'
    let statusIcon = '⏳'
    let statusText = 'Pending'
    let statusColor = 'text-gray-500'

    if (hasError) {
      iconType = 'error'
      statusIcon = '❌'
      statusText = 'Error'
      statusColor = 'text-red-600'
    } else if (isProcessing) {
      iconType = 'processing'
      statusIcon = '🔄'
      statusText = 'Processing...'
      statusColor = 'text-blue-600'
    } else if (note.processed_at) {
      iconType = 'completed'
      statusIcon = '✅'
      statusText = 'Completed'
      statusColor = 'text-green-600'
    }

    return {
      hasError,
      isProcessing,
      processingAttempts,
      errorSeverity,
      iconType,
      statusIcon,
      statusText,
      statusColor
    }
  }, [note])

  const getStatusIcon = () => status.statusIcon
  const getStatusColor = () => status.statusColor
  const getStatusText = () => status.statusText
  const getSentimentColor = (classification: string) => {
    switch (classification?.toLowerCase()) {
      case 'positive': return 'text-green-600'
      case 'negative': return 'text-red-600'
      case 'neutral': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getLoadingStateMessage = () => {
    if (status.isProcessing) {
      return 'Processing your audio... This may take a moment.'
    }
    return 'Audio ready for processing'
  }

  return {
    hasError: status.hasError,
    isProcessing: status.isProcessing,
    processingAttempts: status.processingAttempts,
    errorSeverity: status.errorSeverity,
    iconType: status.iconType,
    getStatusIcon,
    getStatusColor,
    getStatusText,
    getSentimentColor,
    getLoadingStateMessage
  }
}