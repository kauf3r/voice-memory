import { useMemo } from 'react'
import { Note } from '@/lib/types'

type IconType = 'error' | 'success' | 'processing' | 'analyzing' | 'pending'

export function useNoteStatus(note: Note) {
  return useMemo(() => {
    const hasError = !!note.error_message
    const isProcessing = note.processing_started_at && !note.processed_at
    const processingAttempts = note.processing_attempts || 0

    const getErrorSeverity = (errorMessage?: string) => {
      if (!errorMessage) return 'unknown'
      const message = errorMessage.toLowerCase()
      
      if (message.includes('timeout') || message.includes('circuit breaker')) {
        return 'warning' // Temporary issue
      } else if (message.includes('rate limit') || message.includes('quota')) {
        return 'warning' // Rate limiting issue
      } else if (message.includes('network') || message.includes('connection')) {
        return 'warning' // Network issue
      } else if (message.includes('validation') || message.includes('invalid file')) {
        return 'error' // Data issue
      } else if (message.includes('authentication') || message.includes('authorization')) {
        return 'error' // Auth issue
      } else {
        return 'unknown'
      }
    }

    // Determine icon type based on note state
    let iconType: IconType
    if (note.error_message) {
      iconType = 'error'
    } else if (note.transcription && note.analysis) {
      iconType = 'success'
    } else if (note.processing_started_at && !note.processed_at) {
      iconType = 'processing'
    } else if (note.transcription && !note.analysis) {
      iconType = 'analyzing'
    } else {
      iconType = 'pending'
    }

    // Function to get the actual JSX icon
    const getStatusIcon = () => {
      switch (iconType) {
        case 'error':
          return (
            <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )
        case 'success':
          return (
            <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )
        case 'processing':
          return (
            <svg className="h-4 w-4 text-yellow-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )
        case 'analyzing':
          return (
            <svg className="h-4 w-4 text-orange-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          )
        case 'pending':
        default:
          return (
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
      }
    }

    const getStatusColor = () => {
      // Has error message = failed
      if (note.error_message) {
        return 'bg-red-100 text-red-800 border-red-200'
      }
      // Fully completed: has transcription AND analysis
      if (note.transcription && note.analysis) {
        return 'bg-green-100 text-green-800 border-green-200'
      }
      // Currently processing (has processing_started_at but no processed_at)
      if (note.processing_started_at && !note.processed_at) {
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      }
      // Partial: has transcription but missing analysis
      if (note.transcription && !note.analysis) {
        return 'bg-orange-100 text-orange-800 border-orange-200'
      }
      // Still processing
      return 'bg-gray-100 text-gray-800 border-gray-200'
    }

    const getStatusText = () => {
      // Has error message = failed
      if (note.error_message) {
        return 'Failed'
      }
      // Fully completed: has transcription AND analysis
      if (note.transcription && note.analysis) {
        return 'Processed'
      }
      // Currently processing (has processing_started_at but no processed_at)
      if (note.processing_started_at && !note.processed_at) {
        return 'Processing'
      }
      // Partial: has transcription but missing analysis
      if (note.transcription && !note.analysis) {
        return 'Analyzing'
      }
      // Still processing
      return 'Pending'
    }

    const getSentimentColor = (sentiment?: string) => {
      switch (sentiment?.toLowerCase()) {
        case 'positive':
          return 'bg-green-100 text-green-800'
        case 'negative':
          return 'bg-red-100 text-red-800'
        case 'neutral':
        default:
          return 'bg-gray-100 text-gray-800'
      }
    }

    const getLoadingStateMessage = () => {
      if (note.processing_started_at && !note.processed_at) {
        const processingTime = Date.now() - new Date(note.processing_started_at).getTime()
        const minutes = Math.floor(processingTime / 60000)
        
        if (note.transcription && !note.analysis) {
          return `Analyzing transcription... (${minutes}m)`
        } else {
          return `Transcribing audio... (${minutes}m)`
        }
      }
      return 'Queued for processing'
    }

    const errorSeverity = getErrorSeverity(note.error_message)

    return {
      hasError,
      isProcessing,
      processingAttempts,
      errorSeverity,
      iconType,
      getStatusIcon,
      getStatusColor,
      getStatusText,
      getSentimentColor,
      getLoadingStateMessage,
    }
  }, [note])
}