'use client'

import { Note } from '@/lib/types'
import { useState, memo } from 'react'
import LazyAnalysisView from './LazyAnalysisView'

// Import custom hooks
import { useNoteActions, useNoteStatus, useNoteContent } from './hooks'

// Import sub-components
import { 
  NoteHeader, 
  NoteError, 
  NoteTopic, 
  NoteStats, 
  NoteContent 
} from './NoteCard'

interface NoteCardProps {
  note: Note
  onDelete?: (noteId: string) => void
  onRefresh?: () => void
  highlightFilter?: {
    type: string
    value: string
  }
}

function NoteCard({ note, onDelete, onRefresh, highlightFilter }: NoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Custom hooks for functionality
  const { isDeleting, isRetrying, handleDelete, handleRetry } = useNoteActions({
    noteId: note.id,
    onDelete,
    onRefresh,
  })

  const {
    hasError,
    isProcessing,
    processingAttempts,
    errorSeverity,
    getStatusIcon,
    getStatusColor,
    getStatusText,
    getSentimentColor,
    getLoadingStateMessage,
  } = useNoteStatus(note)

  const {
    formatDuration,
    quickStats,
    primaryTopic,
    minorTopics,
    sentiment,
    hasFullAnalysis,
  } = useNoteContent(note)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <NoteHeader
        recordedAt={note.recorded_at}
        durationSeconds={note.duration_seconds}
        processingStartedAt={note.processing_started_at}
        statusIcon={getStatusIcon()}
        statusText={getStatusText()}
        statusColorClasses={getStatusColor()}
        sentiment={sentiment}
        sentimentColorClasses={sentiment ? getSentimentColor(sentiment.classification) : ''}
        processingAttempts={processingAttempts}
        isProcessing={isProcessing}
        hasError={hasError}
        errorSeverity={errorSeverity}
        errorMessage={note.error_message}
        lastErrorAt={note.last_error_at}
        isRetrying={isRetrying}
        isDeleting={isDeleting}
        onRetry={handleRetry}
        onDelete={handleDelete}
        formatDuration={formatDuration}
      />

      {/* Enhanced Error Display */}
      {hasError && (
        <NoteError
          errorMessage={note.error_message!}
          errorSeverity={errorSeverity}
          processingAttempts={processingAttempts}
          lastErrorAt={note.last_error_at}
          noteId={note.id}
          processingStartedAt={note.processing_started_at}
        />
      )}

      {/* Primary Topic */}
      {primaryTopic && (
        <NoteTopic
          primaryTopic={primaryTopic}
          minorTopics={minorTopics}
        />
      )}

      {/* Quick Stats */}
      {note.analysis && (
        <NoteStats
          myTasks={quickStats.myTasks}
          keyIdeas={quickStats.keyIdeas}
          messages={quickStats.messages}
        />
      )}

      {/* Enhanced Content Display with Better Loading States */}
      <NoteContent
        transcription={note.transcription}
        hasError={hasError}
        errorSeverity={errorSeverity}
        isProcessing={isProcessing}
        loadingStateMessage={getLoadingStateMessage()}
      />

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

// Memoize the component to prevent unnecessary re-renders
export default memo(NoteCard, (prevProps, nextProps) => {
  // Only re-render if the note data has actually changed
  return (
    prevProps.note.id === nextProps.note.id &&
    prevProps.note.processed_at === nextProps.note.processed_at &&
    prevProps.note.error_message === nextProps.note.error_message &&
    prevProps.note.transcription === nextProps.note.transcription &&
    JSON.stringify(prevProps.note.analysis) === JSON.stringify(nextProps.note.analysis) &&
    prevProps.highlightFilter?.value === nextProps.highlightFilter?.value
  )
})