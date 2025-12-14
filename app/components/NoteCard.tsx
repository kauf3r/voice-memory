'use client'

import { Note } from '@/lib/types'
import { useState, memo } from 'react'
import AnalysisView from './AnalysisView'

// Import custom hooks
import { useNoteActions, useNoteStatus, useNoteContent } from './hooks'

// Import sub-components
import NoteHeader from './NoteCard/NoteHeader'
import NoteError from './NoteCard/NoteError'
import NoteTopic from './NoteCard/NoteTopic'
import NoteStats from './NoteCard/NoteStats'
import NoteContent from './NoteCard/NoteContent'

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
  const [showTranscript, setShowTranscript] = useState(false)

  // Custom hooks for functionality
  const { isDeleting, isRetrying, isProcessing: isProcessingNow, handleDelete, handleRetry, handleProcessNow } = useNoteActions({
    noteId: note.id,
    onDelete,
    onRefresh,
  })

  const {
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
        isProcessing={isProcessing || isProcessingNow}
        hasError={hasError}
        errorSeverity={errorSeverity}
        errorMessage={note.error_message}
        lastErrorAt={note.last_error_at}
        isRetrying={isRetrying}
        isDeleting={isDeleting}
        onRetry={handleRetry}
        onDelete={handleDelete}
        onProcessNow={handleProcessNow}
        formatDuration={formatDuration}
        showProcessButton={!note.processed_at && !isProcessing && !hasError}
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

      {/* Primary Topic - only show for unprocessed notes (AnalysisView shows topics for processed) */}
      {primaryTopic && !note.analysis && (
        <NoteTopic
          primaryTopic={primaryTopic}
          minorTopics={minorTopics}
        />
      )}

      {/* Show Analysis First (when available) */}
      {note.analysis ? (
        <>
          {/* Full Analysis View - shown by default for processed notes */}
          <div className="mt-4">
            <AnalysisView
              analysis={note.analysis}
              transcription={note.transcription}
              className="space-y-6"
            />
          </div>

          {/* Show Transcript Button */}
          {note.transcription && (
            <>
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors mt-4"
              >
                {showTranscript ? 'Hide transcript' : 'Show transcript'}
              </button>

              {/* Expandable Transcript */}
              {showTranscript && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Full Transcript</h4>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {note.transcription}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* Show processing status/transcript for unprocessed notes */
        <NoteContent
          transcription={note.transcription}
          hasError={hasError}
          errorSeverity={errorSeverity}
          isProcessing={isProcessing}
          loadingStateMessage={getLoadingStateMessage()}
        />
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