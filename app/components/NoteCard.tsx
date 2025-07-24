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
        throw new Error('Failed to retry processing')
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

  const getStatusColor = () => {
    // Has error message = failed
    if (note.error_message) {
      return 'bg-red-100 text-red-800'
    }
    // Fully completed: has transcription AND analysis
    if (note.transcription && note.analysis) {
      return 'bg-green-100 text-green-800'
    }
    // Partial: has transcription but missing analysis
    if (note.transcription && !note.analysis) {
      return 'bg-orange-100 text-orange-800'
    }
    // Still processing
    return 'bg-yellow-100 text-yellow-800'
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
    // Partial: has transcription but missing analysis
    if (note.transcription && !note.analysis) {
      return 'Analyzing'
    }
    // Still processing
    return 'Processing'
  }

  const hasError = !!note.error_message
  const processingAttempts = note.processing_attempts || 0

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
            {note.analysis?.sentiment && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(note.analysis.sentiment.classification)}`}>
                {note.analysis.sentiment.classification}
              </span>
            )}
            {processingAttempts > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {processingAttempts} attempt{processingAttempts !== 1 ? 's' : ''}
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
        </div>
        <div className="flex items-center gap-2">
          {hasError && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="text-red-600 hover:text-red-800 disabled:opacity-50"
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
          )}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-gray-400 hover:text-red-600 disabled:opacity-50"
            title="Delete note"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {hasError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center">
                <svg className="h-4 w-4 text-red-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-red-700">Processing Failed</span>
              </div>
              <p className="text-xs text-red-600 mt-1 ml-6">
                {note.error_message}
              </p>
              {note.last_error_at && (
                <p className="text-xs text-red-500 mt-1 ml-6">
                  Last error: {formatDistanceToNow(new Date(note.last_error_at), { addSuffix: true })}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              className="text-xs text-red-600 hover:text-red-800 ml-2"
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
            <div className="flex gap-2">
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

      {/* Content Display */}
      {note.transcription ? (
        <div className="mb-4">
          <p className="text-sm text-gray-700 line-clamp-3">
            {note.transcription}
          </p>
        </div>
      ) : hasError ? (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 font-medium">No transcription available</p>
          <p className="text-xs text-red-600 mt-1">The audio file could not be transcribed due to an error.</p>
        </div>
      ) : (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-700 font-medium">Processing Audio...</p>
          <p className="text-xs text-yellow-600 mt-1">Your audio is being transcribed and analyzed.</p>
        </div>
      )}

      {/* Expand Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
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