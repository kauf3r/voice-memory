'use client'

import { Note } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import LazyAnalysisView from './LazyAnalysisView'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from './LoadingSpinner'

interface NoteCardProps {
  note: Note
  onDelete?: (noteId: string) => void
  onRefresh?: () => void
  highlightFilter?: {
    type: string
    value: string
  }
}

export default function NoteCard({ note, onDelete, onRefresh, highlightFilter }: NoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [showErrorDetails, setShowErrorDetails] = useState(false)
  const [showErrorTooltip, setShowErrorTooltip] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return
    }

    setIsDeleting(true)
    try {
      // Get the current session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in.')
      }

      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete note')
      }

      onDelete?.(note.id)
    } catch (error) {
      console.error('Delete error:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete note')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRetry = async () => {
    if (!confirm('Retry processing this note?')) {
      return
    }

    setIsRetrying(true)
    try {
      // Get the current session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in.')
      }

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          noteId: note.id, 
          forceReprocess: true 
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to retry processing')
      }

      // Refresh the note data
      onRefresh?.()
    } catch (error) {
      console.error('Retry error:', error)
      alert(error instanceof Error ? error.message : 'Failed to retry processing')
    } finally {
      setIsRetrying(false)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
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

  const getStatusIcon = () => {
    if (note.error_message) {
      return (
        <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      )
    }
    if (note.transcription && note.analysis) {
      return (
        <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )
    }
    if (note.processing_started_at && !note.processed_at) {
      return (
        <svg className="h-4 w-4 text-yellow-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )
    }
    if (note.transcription && !note.analysis) {
      return (
        <svg className="h-4 w-4 text-orange-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
    }
    return (
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
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

  const hasError = !!note.error_message
  const isProcessing = note.processing_started_at && !note.processed_at
  const processingAttempts = note.processing_attempts || 0
  const errorSeverity = getErrorSeverity(note.error_message)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor()}`}>
              <span className="mr-1.5">{getStatusIcon()}</span>
              {getStatusText()}
            </span>
            {note.analysis?.sentiment && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(note.analysis.sentiment.classification)}`}>
                {note.analysis.sentiment.classification}
              </span>
            )}
            {processingAttempts > 0 && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                processingAttempts > 3 ? 'bg-red-100 text-red-800' : 
                processingAttempts > 1 ? 'bg-yellow-100 text-yellow-800' : 
                'bg-gray-100 text-gray-800'
              }`}>
                {processingAttempts} attempt{processingAttempts !== 1 ? 's' : ''}
              </span>
            )}
            {isProcessing && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <span className="animate-pulse mr-1">●</span>
                Processing...
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {formatDistanceToNow(new Date(note.recorded_at), { addSuffix: true })}
          </p>
          {note.duration_seconds && (
            <p className="text-sm text-gray-500">
              Duration: {formatDuration(note.duration_seconds)}
            </p>
          )}
          {note.processing_started_at && (
            <p className="text-xs text-gray-400">
              Processing started: {formatDistanceToNow(new Date(note.processing_started_at), { addSuffix: true })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasError && (
            <>
              <button
                onClick={handleRetry}
                disabled={!!(isRetrying || isProcessing)}
                className={`transition-colors ${
                  errorSeverity === 'warning' 
                    ? 'text-yellow-600 hover:text-yellow-800' 
                    : 'text-red-600 hover:text-red-800'
                } disabled:opacity-50`}
                title="Retry processing"
              >
                {isRetrying ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
              </button>
              {/* Error tooltip */}
              <div className="relative">
                <button
                  onMouseEnter={() => setShowErrorTooltip(true)}
                  onMouseLeave={() => setShowErrorTooltip(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Error details"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </button>
                {showErrorTooltip && (
                  <div className="absolute right-0 top-6 z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg">
                    <div className="font-medium mb-1">Error Category: {errorSeverity}</div>
                    <div className="break-words">{note.error_message}</div>
                    {note.last_error_at && (
                      <div className="text-gray-300 mt-1">
                        {formatDistanceToNow(new Date(note.last_error_at), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
          <button
            onClick={handleDelete}
            disabled={!!(isDeleting || isProcessing)}
            className="text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors"
            title="Delete note"
          >
            {isDeleting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Enhanced Error Display */}
      {hasError && (
        <div className={`mb-4 p-3 border rounded-lg ${
          errorSeverity === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center">
                <svg className={`h-4 w-4 mr-2 mt-0.5 ${
                  errorSeverity === 'warning' ? 'text-yellow-500' : 'text-red-500'
                }`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className={`text-sm font-medium ${
                  errorSeverity === 'warning' ? 'text-yellow-700' : 'text-red-700'
                }`}>
                  {errorSeverity === 'warning' ? 'Processing Issue' : 'Processing Failed'}
                </span>
                {processingAttempts > 1 && (
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                    errorSeverity === 'warning' ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100'
                  }`}>
                    After {processingAttempts} attempts
                  </span>
                )}
              </div>
              <p className={`text-xs mt-1 ml-6 break-words ${
                errorSeverity === 'warning' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {note.error_message}
              </p>
              {note.last_error_at && (
                <p className={`text-xs mt-1 ml-6 ${
                  errorSeverity === 'warning' ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  Last error: {formatDistanceToNow(new Date(note.last_error_at), { addSuffix: true })}
                </p>
              )}
              {showErrorDetails && (
                <div className={`mt-3 ml-6 p-2 border rounded text-xs ${
                  errorSeverity === 'warning' 
                    ? 'bg-yellow-100 border-yellow-200 text-yellow-700' 
                    : 'bg-red-100 border-red-200 text-red-700'
                }`}>
                  <div className="font-medium mb-1">Error Details:</div>
                  <div>Note ID: {note.id}</div>
                  <div>Processing Attempts: {processingAttempts}</div>
                  <div>Error Severity: {errorSeverity}</div>
                  {note.processing_started_at && (
                    <div>Last Processing Started: {new Date(note.processing_started_at).toLocaleString()}</div>
                  )}
                  {note.last_error_at && (
                    <div>Last Error At: {new Date(note.last_error_at).toLocaleString()}</div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              className={`text-xs ml-2 transition-colors ${
                errorSeverity === 'warning' 
                  ? 'text-yellow-600 hover:text-yellow-800' 
                  : 'text-red-600 hover:text-red-800'
              }`}
            >
              {showErrorDetails ? 'Hide' : 'Details'}
            </button>
          </div>
        </div>
      )}

      {/* Primary Topic */}
      {note.analysis?.focusTopics?.primary && (
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {note.analysis.focusTopics.primary}
          </h3>
          {note.analysis.focusTopics.minor && (
            <div className="flex gap-2 flex-wrap">
              {note.analysis.focusTopics.minor.map((topic, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      {note.analysis && (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-semibold text-blue-600">
              {note.analysis.tasks?.myTasks?.length || 0}
            </p>
            <p className="text-xs text-gray-500">My Tasks</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-green-600">
              {note.analysis.keyIdeas?.length || 0}
            </p>
            <p className="text-xs text-gray-500">Key Ideas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-purple-600">
              {note.analysis.messagesToDraft?.length || 0}
            </p>
            <p className="text-xs text-gray-500">Messages</p>
          </div>
        </div>
      )}

      {/* Enhanced Content Display with Better Loading States */}
      {note.transcription ? (
        <div className="mb-4">
          <p className="text-sm text-gray-700 line-clamp-3">
            {note.transcription}
          </p>
        </div>
      ) : hasError ? (
        <div className={`mb-4 p-3 border rounded-lg ${
          errorSeverity === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-sm font-medium ${
            errorSeverity === 'warning' ? 'text-yellow-700' : 'text-red-700'
          }`}>No transcription available</p>
          <p className={`text-xs mt-1 ${
            errorSeverity === 'warning' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {errorSeverity === 'warning' 
              ? 'Processing encountered an issue. You can retry processing.' 
              : 'The audio file could not be transcribed due to an error.'}
          </p>
        </div>
      ) : isProcessing ? (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <svg className="animate-spin h-4 w-4 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div>
              <p className="text-sm text-blue-700 font-medium">{getLoadingStateMessage()}</p>
              <p className="text-xs text-blue-600 mt-1">
                {note.transcription 
                  ? 'AI is analyzing your transcription for insights and tasks.'
                  : 'Your audio is being transcribed using OpenAI Whisper.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <svg className="h-4 w-4 text-yellow-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-yellow-700 font-medium">Queued for Processing</p>
              <p className="text-xs text-yellow-600 mt-1">Your audio will be processed automatically.</p>
            </div>
          </div>
        </div>
      )}

      {/* Expand Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        disabled={!note.analysis && !note.transcription}
      >
        {isExpanded ? 'Show less' : 'Show full analysis'}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <LazyAnalysisView
            noteId={note.id}
            analysis={note.analysis || null}
            transcription={note.transcription}
            className="space-y-6"
          />
        </div>
      )}
    </div>
  )
}