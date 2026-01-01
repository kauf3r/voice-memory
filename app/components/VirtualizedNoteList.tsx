'use client'

import { useMemo, useState, useCallback } from 'react'
import { Note } from '@/lib/types'

interface VirtualizedNoteListProps {
  notes: Note[]
  className?: string
  children: (note: Note, index: number) => React.ReactNode
  itemHeight?: number
  containerHeight?: number
  enableVirtualization?: boolean
}

export default function VirtualizedNoteList({ 
  notes, 
  className = '', 
  children,
  itemHeight = 400,
  containerHeight = 600,
  enableVirtualization = false
}: VirtualizedNoteListProps) {
  const [showAll, setShowAll] = useState(false)

  // Always call hooks consistently
  const renderItem = useCallback((note: Note, index: number) => {
    return (
      <div key={note.id} className="mb-4">
        {children(note, index)}
      </div>
    )
  }, [children])

  // Calculate display notes
  const displayNotes = useMemo(() => {
    return showAll ? notes : notes.slice(0, 50)
  }, [notes, showAll])

  // Simple rendering only - disable virtualization to prevent hook issues
  return (
    <div className={className}>
      <div className="space-y-4">
        {displayNotes.map((note, index) => (
          <div key={note.id}>
            {children(note, index)}
          </div>
        ))}
      </div>
      
      {notes.length > 50 && !showAll && (
        <div className="text-center py-8">
          <p className="text-gray-500 text-sm mb-4">
            Showing {displayNotes.length} of {notes.length} notes
          </p>
          <button 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            onClick={() => setShowAll(true)}
          >
            Show All Notes ({notes.length})
          </button>
        </div>
      )}

      {showAll && notes.length > 50 && (
        <div className="text-center py-4">
          <button 
            className="text-blue-600 hover:text-blue-700 text-sm underline"
            onClick={() => setShowAll(false)}
          >
            Show Less
          </button>
        </div>
      )}
    </div>
  )
}