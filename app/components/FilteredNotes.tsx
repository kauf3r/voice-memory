'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Note } from '@/lib/types'
import NoteCard from './NoteCard'
import { LoadingSpinner } from './LoadingSpinner'

interface FilteredNotesProps {
  filterType: 'topic' | 'contact' | 'sentiment' | 'date'
  filterValue: string
  onClose: () => void
}

export default function FilteredNotes({ filterType, filterValue, onClose }: FilteredNotesProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchFilteredNotes()
  }, [filterType, filterValue])

  const fetchFilteredNotes = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch(`/api/notes/filter?type=${filterType}&value=${encodeURIComponent(filterValue)}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch filtered notes')
      }

      const data = await response.json()
      setNotes(data.notes || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  const getFilterTitle = () => {
    switch (filterType) {
      case 'topic':
        return `Notes about "${filterValue}"`
      case 'contact':
        return `Notes mentioning "${filterValue}"`
      case 'sentiment':
        return `${filterValue} sentiment notes`
      case 'date':
        return `Notes from ${filterValue}`
      default:
        return 'Filtered Notes'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{getFilterTitle()}</h2>
            <p className="text-gray-600 mt-1">
              {loading ? 'Loading...' : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} found`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchFilteredNotes}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && notes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>No notes found for this filter.</p>
            </div>
          )}

          {!loading && !error && notes.length > 0 && (
            <div className="space-y-4">
              {notes.map((note) => (
                <div key={note.id} className="border border-gray-200 rounded-lg">
                  <NoteCard 
                    note={note} 
                    onRefresh={fetchFilteredNotes}
                    highlightFilter={{
                      type: filterType,
                      value: filterValue
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Filter: {filterType} = "{filterValue}"
            </div>
            <button
              onClick={onClose}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}