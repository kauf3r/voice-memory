'use client'

interface NoteContentProps {
  transcription?: string
  hasError: boolean
  errorSeverity: 'low' | 'medium' | 'high'
  isProcessing: boolean
  loadingStateMessage: string
}

export default function NoteContent({ 
  transcription, 
  hasError, 
  errorSeverity, 
  isProcessing, 
  loadingStateMessage 
}: NoteContentProps) {
  if (isProcessing) {
    return (
      <div className="text-gray-500 italic p-4 bg-gray-50 rounded-md">
        {loadingStateMessage}
      </div>
    )
  }

  if (hasError && !transcription) {
    return (
      <div className="text-red-500 italic p-4 bg-red-50 rounded-md">
        Processing failed. Please try again or contact support if the issue persists.
      </div>
    )
  }

  if (!transcription) {
    return (
      <div className="text-gray-500 italic p-4 bg-gray-50 rounded-md">
        No transcription available. Click "Process Now" to analyze this audio.
      </div>
    )
  }

  return (
    <div className="text-gray-700 leading-relaxed mb-4">
      <div className="text-sm font-medium text-gray-600 mb-2">Transcription:</div>
      <div className="prose prose-sm max-w-none">
        {transcription}
      </div>
    </div>
  )
}