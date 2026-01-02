'use client'

import { useAuth } from './components/AuthProvider'
import Layout, { GridContainer, GridItem } from './components/Layout'
import { LoadingPage } from './components/LoadingSpinner'
import LoginForm from './components/LoginForm'
import AutoAuth from './components/AutoAuth'
import UploadButton from './components/UploadButton'
import NoteCard from './components/NoteCard'
import { ProcessingStatus } from './components/ProcessingStatus'
import SearchBar from './components/SearchBar'
import VirtualizedNoteList from './components/VirtualizedNoteList'
import ConnectionStatusIndicator from './components/ConnectionStatusIndicator'
import { useNotes } from '@/lib/hooks/use-notes'
import { useInfiniteScroll } from '@/lib/hooks/use-intersection-observer'
import { useMemo, useCallback, useEffect } from 'react'
import { MutationInvalidators } from '@/lib/cache/CacheInvalidationManager'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

export default function Home() {
  const { user, loading: authLoading } = useAuth()
  
  // Only call useNotes if user is authenticated
  const { notes, loading: notesLoading, error, totalCount, hasMore, refresh, loadMore } = useNotes({
    // Pass a flag to disable the hook when user is not authenticated
    enabled: !!user
  })
  
  // Let AuthProvider handle all authentication - no duplicate token processing needed
  useEffect(() => {
    // This useEffect is kept for potential future home page initialization
    // All authentication is now handled by AuthProvider exclusively
  }, [])
  
  // All hooks must be called before any conditional returns
  // Infinite scroll trigger element
  const infiniteScrollRef = useInfiniteScroll(loadMore, hasMore, notesLoading)

  // Memoize expensive calculations
  const processingStats = useMemo(() => {
    const processingCount = notes.filter(note => !note.processed_at).length
    const processedCount = notes.filter(note => note.processed_at).length
    return { processingCount, processedCount }
  }, [notes])

  // Optimized event handlers with cache invalidation
  const handleUploadComplete = useCallback(async () => {
    // Invalidate caches when new note is uploaded
    if (user?.id) {
      MutationInvalidators.afterNoteUpload(user.id)
    }
    await refresh()
  }, [refresh, user?.id])

  const handleNoteDelete = useCallback(async () => {
    // Invalidate caches when note is deleted
    if (user?.id) {
      MutationInvalidators.afterNoteDelete(user.id, '')
    }
    await refresh()
  }, [refresh, user?.id])

  // Memoized render function for note cards
  const renderNoteCard = useCallback((note: any, index: number) => (
    <NoteCard 
      key={note.id}
      note={note} 
      onDelete={handleNoteDelete}
    />
  ), [handleNoteDelete])

  // Conditional returns after all hooks
  if (authLoading) {
    return <LoadingPage />
  }

  if (!user) {
    return (
      <Layout>
        <div className="space-y-6">
          <AutoAuth />
          <LoginForm />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Show errors only if they occur */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-red-700 text-sm">{error}</p>
            <button 
              onClick={refresh}
              className="mt-2 text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Voice Memory</h1>
          <p className="text-lg text-gray-600">Transform your voice notes into actionable insights</p>
        </div>

        {/* Upload Section */}
        <div className="max-w-2xl mx-auto">
          <UploadButton
            onUploadComplete={handleUploadComplete}
            onUploadStart={(file) => {
              console.log('Upload started:', file.name)
            }}
          />
        </div>

        {/* Processing Status */}
        <ProcessingStatus onRefresh={() => refresh()} />

        {/* Stats Grid */}
        <GridContainer>
          <GridItem className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Total Notes</h3>
            <p className="text-3xl font-bold text-blue-600">{totalCount}</p>
            <p className="text-sm text-gray-500">
              {totalCount === 0 ? 'No notes yet' : 'Voice recordings'}
            </p>
          </GridItem>
          
          <GridItem className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Processing</h3>
            <p className="text-3xl font-bold text-orange-600">{processingStats.processingCount}</p>
            <p className="text-sm text-gray-500">In queue</p>
          </GridItem>
          
          <GridItem className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Processed</h3>
            <p className="text-3xl font-bold text-green-600">{processingStats.processedCount}</p>
            <p className="text-sm text-gray-500">With insights</p>
          </GridItem>
        </GridContainer>

        {/* Search Bar */}
        {totalCount > 0 && (
          <div className="max-w-2xl mx-auto">
            <SearchBar />
          </div>
        )}

        {/* Recent Notes */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Notes</h2>
            <div className="flex items-center gap-4">
              <ConnectionStatusIndicator showLabel={true} />
              {notes.length > 0 && (
                <button
                  onClick={refresh}
                  disabled={notesLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  Refresh
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {notesLoading && notes.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading notes...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No voice notes yet. Upload your first recording to get started!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Optimized Notes List with Virtualization */}
              <VirtualizedNoteList
                notes={notes}
                itemHeight={400}
                containerHeight={800}
                enableVirtualization={notes.length > 10}
                className="space-y-4"
              >
                {renderNoteCard}
              </VirtualizedNoteList>

              {/* Infinite Scroll Trigger */}
              {hasMore && (
                <div ref={infiniteScrollRef} className="text-center py-4">
                  {notesLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-gray-500">Loading more notes...</span>
                    </div>
                  ) : (
                    <button
                      onClick={loadMore}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                    >
                      Load More Notes
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}