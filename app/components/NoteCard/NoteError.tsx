'use client'

interface NoteErrorProps {
  errorMessage: string
  errorSeverity: 'low' | 'medium' | 'high'
  processingAttempts?: number
  lastErrorAt?: string
  noteId: string
  processingStartedAt?: string
}

export default function NoteError({ 
  errorMessage, 
  errorSeverity, 
  processingAttempts, 
  lastErrorAt,
  noteId,
  processingStartedAt 
}: NoteErrorProps) {
  const severityColors = {
    low: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    medium: 'bg-orange-50 border-orange-200 text-orange-800',
    high: 'bg-red-50 border-red-200 text-red-800'
  }

  return (
    <div className={`p-3 rounded-md border ${severityColors[errorSeverity]} mb-4`}>
      <div className="text-sm font-medium mb-1">Processing Error</div>
      <div className="text-sm">{errorMessage}</div>
      {lastErrorAt && (
        <div className="text-xs mt-1 opacity-75">
          Last error: {new Date(lastErrorAt).toLocaleString()}
        </div>
      )}
    </div>
  )
}