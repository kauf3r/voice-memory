import { memo } from 'react'

interface NoteContentProps {
  transcription?: string | null
  hasError: boolean
  errorSeverity: string
  isProcessing: boolean
  loadingStateMessage: string
}

function NoteContent({ 
  transcription, 
  hasError, 
  errorSeverity, 
  isProcessing, 
  loadingStateMessage 
}: NoteContentProps) {
  if (transcription) {
    return (
      <div className="mb-4">
        <p className="text-sm text-gray-700 line-clamp-3">
          {transcription}
        </p>
      </div>
    )
  }

  if (hasError) {
    return (
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
    )
  }

  if (isProcessing) {
    return (
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center">
          <svg className="animate-spin h-4 w-4 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div>
            <p className="text-sm text-blue-700 font-medium">{loadingStateMessage}</p>
            <p className="text-xs text-blue-600 mt-1">
              {transcription 
                ? 'AI is analyzing your transcription for insights and tasks.'
                : 'Your audio is being transcribed using OpenAI Whisper.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
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
  )
}

export default memo(NoteContent)