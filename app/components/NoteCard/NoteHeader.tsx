'use client'

import { useState } from 'react'

interface NoteHeaderProps {
  recordedAt: string
  durationSeconds?: number
  processingStartedAt?: string
  statusIcon: string
  statusText: string
  statusColorClasses: string
  mood?: string | null
  moodColorClasses: string
  processingAttempts?: number
  isProcessing: boolean
  hasError: boolean
  errorSeverity: 'low' | 'medium' | 'high'
  errorMessage?: string
  lastErrorAt?: string
  isRetrying: boolean
  isDeleting: boolean
  onRetry: () => void
  onDelete: () => void
  onProcessNow?: () => void
  formatDuration: (seconds?: number) => string
  showProcessButton?: boolean
}

export default function NoteHeader({
  recordedAt,
  durationSeconds,
  processingStartedAt,
  statusIcon,
  statusText,
  statusColorClasses,
  mood,
  moodColorClasses,
  processingAttempts,
  isProcessing,
  hasError,
  errorSeverity,
  errorMessage,
  lastErrorAt,
  isRetrying,
  isDeleting,
  onRetry,
  onDelete,
  onProcessNow,
  formatDuration,
  showProcessButton = false
}: NoteHeaderProps) {
  const [isProcessingNow, setIsProcessingNow] = useState(false)
  
  const handleProcessNow = async () => {
    if (!onProcessNow || isProcessingNow) return
    
    setIsProcessingNow(true)
    try {
      await onProcessNow()
    } finally {
      setIsProcessingNow(false)
    }
  }

  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
          <span>{new Date(recordedAt).toLocaleString()}</span>
          {durationSeconds && (
            <>
              <span>•</span>
              <span>{formatDuration(durationSeconds)}</span>
            </>
          )}
        </div>
        
        <div className={`flex items-center space-x-2 text-sm ${statusColorClasses}`}>
          <span>{statusIcon}</span>
          <span>{statusText}</span>
          {processingAttempts && processingAttempts > 1 && (
            <span className="text-orange-600">({processingAttempts} attempts)</span>
          )}
        </div>
        
        {mood && (
          <div className={`text-sm mt-1 capitalize ${moodColorClasses}`}>
            Mood: {mood}
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {showProcessButton && !isProcessing && !hasError && (
          <button
            onClick={handleProcessNow}
            disabled={isProcessingNow}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessingNow ? 'Processing...' : 'Process Now'}
          </button>
        )}
        
        {hasError && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="px-3 py-1 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
        
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="px-2 py-1 text-sm text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  )
}