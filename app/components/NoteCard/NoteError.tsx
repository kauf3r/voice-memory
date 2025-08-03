import { memo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface NoteErrorProps {
  errorMessage: string
  errorSeverity: string
  processingAttempts: number
  lastErrorAt?: string
  noteId: string
  processingStartedAt?: string | null
}

function NoteError({
  errorMessage,
  errorSeverity,
  processingAttempts,
  lastErrorAt,
  noteId,
  processingStartedAt,
}: NoteErrorProps) {
  const [showErrorDetails, setShowErrorDetails] = useState(false)

  return (
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
            {errorMessage}
          </p>
          {lastErrorAt && (
            <p className={`text-xs mt-1 ml-6 ${
              errorSeverity === 'warning' ? 'text-yellow-500' : 'text-red-500'
            }`}>
              Last error: {formatDistanceToNow(new Date(lastErrorAt), { addSuffix: true })}
            </p>
          )}
          {showErrorDetails && (
            <div className={`mt-3 ml-6 p-2 border rounded text-xs ${
              errorSeverity === 'warning' 
                ? 'bg-yellow-100 border-yellow-200 text-yellow-700' 
                : 'bg-red-100 border-red-200 text-red-700'
            }`}>
              <div className="font-medium mb-1">Error Details:</div>
              <div>Note ID: {noteId}</div>
              <div>Processing Attempts: {processingAttempts}</div>
              <div>Error Severity: {errorSeverity}</div>
              {processingStartedAt && (
                <div>Last Processing Started: {new Date(processingStartedAt).toLocaleString()}</div>
              )}
              {lastErrorAt && (
                <div>Last Error At: {new Date(lastErrorAt).toLocaleString()}</div>
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
  )
}

export default memo(NoteError)