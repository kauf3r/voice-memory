import { memo, useState } from 'react'
import LoadingSpinner from '../LoadingSpinner'
import { formatDistanceToNow } from 'date-fns'

interface NoteActionsProps {
  hasError: boolean
  errorSeverity: string
  errorMessage?: string
  lastErrorAt?: string
  isRetrying: boolean
  isDeleting: boolean
  isProcessing: boolean
  onRetry: () => void
  onDelete: () => void
}

function NoteActions({ 
  hasError, 
  errorSeverity, 
  errorMessage, 
  lastErrorAt,
  isRetrying, 
  isDeleting, 
  isProcessing, 
  onRetry, 
  onDelete 
}: NoteActionsProps) {
  const [showErrorTooltip, setShowErrorTooltip] = useState(false)

  return (
    <div className="flex items-center gap-2">
      {hasError && (
        <>
          <button
            onClick={onRetry}
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
                <div className="break-words">{errorMessage}</div>
                {lastErrorAt && (
                  <div className="text-gray-300 mt-1">
                    {formatDistanceToNow(new Date(lastErrorAt), { addSuffix: true })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      <button
        onClick={onDelete}
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
  )
}

export default memo(NoteActions)