'use client'

import { lazy, Suspense } from 'react'
import LoadingSpinner from './LoadingSpinner'

// Lazy load the heavy TrelloExportModal component
const TrelloExportModal = lazy(() => import('./TrelloExportModal'))

interface LazyTrelloExportModalProps {
  tasksCount: number
  onClose: () => void
}

export default function LazyTrelloExportModal(props: LazyTrelloExportModalProps) {
  return (
    <Suspense 
      fallback={
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex items-center justify-center">
              <LoadingSpinner size="sm" />
              <span className="ml-3 text-gray-600">Loading Trello export...</span>
            </div>
          </div>
        </div>
      }
    >
      <TrelloExportModal {...props} />
    </Suspense>
  )
}