'use client'

import { useState } from 'react'
import TrelloExportModal from './TrelloExportModal'

interface TrelloExportButtonProps {
  tasksCount: number
  disabled?: boolean
}

export default function TrelloExportButton({ tasksCount, disabled = false }: TrelloExportButtonProps) {
  const [showModal, setShowModal] = useState(false)

  const handleExportClick = () => {
    if (disabled || tasksCount === 0) return
    setShowModal(true)
  }

  return (
    <>
      <button
        onClick={handleExportClick}
        disabled={disabled || tasksCount === 0}
        className={`
          inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
          ${disabled || tasksCount === 0
            ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
            : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          }
        `}
        title={
          tasksCount === 0 
            ? 'No tasks available to export'
            : disabled 
            ? 'Export currently unavailable'
            : `Export ${tasksCount} tasks to Trello`
        }
      >
        <svg 
          className="w-4 h-4 mr-2" 
          fill="currentColor" 
          viewBox="0 0 24 24"
        >
          <path d="M21 0H3C1.35 0 0 1.35 0 3v18c0 1.65 1.35 3 3 3h18c1.65 0 3-1.35 3-3V3c0-1.65-1.35-3-3-3zM10.5 18.75c0 .414-.336.75-.75.75H4.5c-.414 0-.75-.336-.75-.75V5.25c0-.414.336-.75.75-.75h5.25c.414 0 .75.336.75.75v13.5zm9.75-6c0 .414-.336.75-.75.75H14.25c-.414 0-.75-.336-.75-.75V5.25c0-.414.336-.75.75-.75h5.25c.414 0 .75.336.75.75v7.5z"/>
        </svg>
        Export to Trello
        {tasksCount > 0 && (
          <span className="ml-1 bg-white bg-opacity-20 text-xs px-2 py-0.5 rounded-full">
            {tasksCount}
          </span>
        )}
      </button>

      {showModal && (
        <TrelloExportModal
          tasksCount={tasksCount}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}