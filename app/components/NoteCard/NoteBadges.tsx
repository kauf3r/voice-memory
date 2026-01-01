import { memo } from 'react'

interface NoteBadgesProps {
  sentiment?: {
    classification: string
  }
  sentimentColorClasses: string
  processingAttempts: number
  isProcessing: boolean
}

function NoteBadges({ sentiment, sentimentColorClasses, processingAttempts, isProcessing }: NoteBadgesProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {sentiment && (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sentimentColorClasses}`}>
          {sentiment.classification}
        </span>
      )}
      {processingAttempts > 0 && (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
          processingAttempts > 3 ? 'bg-red-100 text-red-800' : 
          processingAttempts > 1 ? 'bg-yellow-100 text-yellow-800' : 
          'bg-gray-100 text-gray-800'
        }`}>
          {processingAttempts} attempt{processingAttempts !== 1 ? 's' : ''}
        </span>
      )}
      {isProcessing && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <span className="animate-pulse mr-1">●</span>
          Processing...
        </span>
      )}
    </div>
  )
}

export default memo(NoteBadges)