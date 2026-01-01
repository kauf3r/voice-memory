'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'

interface SearchResult {
  id: string
  title: string
  snippet: string
  type: 'note' | 'transcription' | 'analysis'
  sentiment?: string
  recordedAt: string
}

interface SearchBarProps {
  onSearchResults?: (results: SearchResult[]) => void
  onSearchStart?: () => void
  onSearchClear?: () => void
  placeholder?: string
  className?: string
}

export default function SearchBar({
  onSearchResults,
  onSearchStart,
  onSearchClear,
  placeholder = "Search notes, transcriptions, and analysis...",
  className = ""
}: SearchBarProps) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Debounced search function
  const performSearch = async (searchQuery: string) => {
    console.log('🔍 SearchBar performSearch called:', { searchQuery, hasUser: !!user })
    if (!searchQuery.trim() || !user) {
      console.log('🔍 SearchBar early return:', { emptyQuery: !searchQuery.trim(), noUser: !user })
      setResults([])
      setShowResults(false)
      onSearchClear?.()
      return
    }

    setIsSearching(true)
    onSearchStart?.()

    try {
      // Get the session token for authentication
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.log('🔍 SearchBar: No session token available')
        return
      }

      console.log('🔍 SearchBar fetching:', `/api/search?q=${encodeURIComponent(searchQuery)}&limit=10`)
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.log('🔍 SearchBar API error:', response.status)
        throw new Error('Search failed')
      }

      const data = await response.json()
      console.log('🔍 SearchBar results:', { count: data.results?.length, results: data.results })
      setResults(data.results || [])
      setShowResults(true)
      onSearchResults?.(data.results || [])
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Handle input change with debouncing
  const handleInputChange = (value: string) => {
    setQuery(value)
    setSelectedIndex(-1)

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Set new debounce
    debounceRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex])
        }
        break
      case 'Escape':
        setShowResults(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    setQuery(result.title)
    setShowResults(false)
    // Could navigate to the specific note here
    // window.location.href = `/notes/${result.id}`
  }

  // Handle clear search
  const handleClear = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
    onSearchClear?.()
    inputRef.current?.focus()
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'transcription': return '🎤'
      case 'analysis': return '🧠'
      default: return '📝'
    }
  }

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'text-green-600'
      case 'negative': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className={`h-5 w-5 transition-colors ${
              isSearching ? 'text-blue-500 animate-spin' : 'text-gray-400'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {isSearching ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            )}
          </svg>
        </div>
        
        <input
          ref={inputRef}
          type="text"
          id="search-input"
          name="search"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query && setShowResults(true)}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
          aria-label="Search notes, transcriptions, and analysis"
          role="searchbox"
        />

        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600"
          >
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.length > 0 ? (
            <div className="py-2">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                    index === selectedIndex ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-1">
                      {getResultIcon(result.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </h4>
                        {result.sentiment && (
                          <span className={`text-xs ${getSentimentColor(result.sentiment)}`}>
                            {result.sentiment}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-1">
                        {result.snippet}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="capitalize">{result.type}</span>
                        <span>•</span>
                        <span>{formatDate(result.recordedAt)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query.length > 0 && !isSearching ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>No results found for "{query}"</p>
              <p className="text-sm mt-1">Try different keywords or check spelling</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}