import { memo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import NoteStatus from './NoteStatus'
import NoteBadges from './NoteBadges'
import NoteActions from './NoteActions'

interface NoteHeaderProps {
  recordedAt: string
  durationSeconds?: number | null
  processingStartedAt?: string | null
  // Status props
  statusIcon: JSX.Element
  statusText: string
  statusColorClasses: string
  // Badge props
  sentiment?: { classification: string }
  sentimentColorClasses: string
  processingAttempts: number
  isProcessing: boolean
  // Actions props
  hasError: boolean
  errorSeverity: string
  errorMessage?: string
  lastErrorAt?: string
  isRetrying: boolean
  isDeleting: boolean
  onRetry: () => void
  onDelete: () => void
  // Utility functions
  formatDuration: (seconds: number | null) => string
}

function NoteHeader({
  recordedAt,
  durationSeconds,
  processingStartedAt,
  statusIcon,
  statusText,
  statusColorClasses,
  sentiment,
  sentimentColorClasses,
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
  formatDuration,
}: NoteHeaderProps) {
  return (
    <div className="flex justify-between items-start mb-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <NoteStatus
            icon={statusIcon}
            text={statusText}
            colorClasses={statusColorClasses}
          />
          <NoteBadges
            sentiment={sentiment}
            sentimentColorClasses={sentimentColorClasses}
            processingAttempts={processingAttempts}
            isProcessing={isProcessing}
          />
        </div>
        <p className="text-sm text-gray-500">
          {formatDistanceToNow(new Date(recordedAt), { addSuffix: true })}
        </p>
        {durationSeconds && (
          <p className="text-sm text-gray-500">
            Duration: {formatDuration(durationSeconds)}
          </p>
        )}
        {processingStartedAt && (
          <p className="text-xs text-gray-400">
            Processing started: {formatDistanceToNow(new Date(processingStartedAt), { addSuffix: true })}
          </p>
        )}
      </div>
      <NoteActions
        hasError={hasError}
        errorSeverity={errorSeverity}
        errorMessage={errorMessage}
        lastErrorAt={lastErrorAt}
        isRetrying={isRetrying}
        isDeleting={isDeleting}
        isProcessing={isProcessing}
        onRetry={onRetry}
        onDelete={onDelete}
      />
    </div>
  )
}

export default memo(NoteHeader)