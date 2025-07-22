'use client'

import { Note } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'
import LazyAnalysisView from './LazyAnalysisView'
import { supabase } from '@/lib/supabase'

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
    if (note.processed_at) {
      return 'bg-green-100 text-green-800'
    }
    return 'bg-yellow-100 text-yellow-800'
  }

  const getStatusText = () => {
    if (note.processed_at) {
      return 'Processed'
    }
    return 'Processing'
  }

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
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-gray-400 hover:text-red-600 disabled:opacity-50"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

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

      {/* Transcription Preview */}
      {note.transcription && (
        <div className="mb-4">
          <p className="text-sm text-gray-700 line-clamp-3">
            {note.transcription}
          </p>
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