'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Note } from '@/lib/types'
import NoteCard from './NoteCard'
import LoadingSpinner from './LoadingSpinner'

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
      
      if (sessionError) {
        console.error('Session error:', sessionError)
        throw new Error(`Session error: ${sessionError.message}`)
      }
      
      if (!session) {
        console.error('No active session found')
        throw new Error('No active session. Please log in again.')
      }

      console.log('Making filtered notes request with token:', session.access_token?.substring(0, 20) + '...')
      console.log('Filter details:', { filterType, filterValue })
      
      // Special debug logging for date filters
      if (filterType === 'date') {
        console.log('🗓️ DATE FILTER DEBUG:')
        console.log('  Original filterValue:', filterValue)
        console.log('  Encoded filterValue:', encodeURIComponent(filterValue))
        console.log('  Expected date format: YYYY-MM-DD')
        console.log('  Current user:', session.user?.id)
        console.log('  Session expires:', new Date(session.expires_at! * 1000).toISOString())
      }

      const url = `/api/notes/filter?type=${filterType}&value=${encodeURIComponent(filterValue)}`
      console.log('Fetch URL:', url)

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', errorData)
        throw new Error(errorData.error || `Failed to fetch filtered notes (${response.status})`)
      }

      const data = await response.json()
      console.log('Received data:', data)
      
      // Special debug logging for date filters
      if (filterType === 'date') {
        console.log('🗓️ DATE FILTER RESPONSE DEBUG:')
        console.log('  Response success:', data.success)
        console.log('  Notes count:', data.notes?.length || 0)
        console.log('  Filter applied:', data.filter)
        
        if (data.notes?.length === 0) {
          console.log('  ⚠️ NO NOTES FOUND - Possible issues:')
          console.log('    1. Date format mismatch')
          console.log('    2. User has no notes on this date')
          console.log('    3. Notes exist but have no analysis')
          console.log('    4. Timezone conversion issue')
        } else {
          console.log('  ✅ Notes found for date filter')
          data.notes?.forEach((note: any, index: number) => {
            console.log(`    ${index + 1}. Note ${note.id} - ${note.recorded_at}`)
          })
        }
      }
      
      setNotes(data.notes || [])
    } catch (err) {
      console.error('fetchFilteredNotes error:', err)
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