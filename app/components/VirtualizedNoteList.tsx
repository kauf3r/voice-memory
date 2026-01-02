'use client'

import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Note } from '@/lib/types'

interface VirtualizedNoteListProps {
  notes: Note[]
  className?: string
  children: (note: Note, index: number) => React.ReactNode
  itemHeight?: number
  containerHeight?: number
  enableVirtualization?: boolean
  overscan?: number
}

interface VisibilityState {
  [key: string]: boolean
}

export default function VirtualizedNoteList({
  notes,
  className = '',
  children,
  itemHeight = 400,
  containerHeight = 600,
  enableVirtualization = true,
  overscan = 3
}: VirtualizedNoteListProps) {
  const [visibleItems, setVisibleItems] = useState<VisibilityState>({})
  const observerRef = useRef<IntersectionObserver | null>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Set up IntersectionObserver for virtualization
  useEffect(() => {
    if (!enableVirtualization) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const updates: VisibilityState = {}
        entries.forEach((entry) => {
          const noteId = entry.target.getAttribute('data-note-id')
          if (noteId) {
            updates[noteId] = entry.isIntersecting
          }
        })
        setVisibleItems((prev) => ({ ...prev, ...updates }))
      },
      {
        rootMargin: `${itemHeight * overscan}px 0px`,
        threshold: 0,
      }
    )

    // Observe all current items
    itemRefs.current.forEach((element) => {
      observerRef.current?.observe(element)
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [enableVirtualization, itemHeight, overscan])

  // Register item ref for observation
  const setItemRef = useCallback((noteId: string, element: HTMLDivElement | null) => {
    if (element) {
      itemRefs.current.set(noteId, element)
      observerRef.current?.observe(element)
    } else {
      const existing = itemRefs.current.get(noteId)
      if (existing) {
        observerRef.current?.unobserve(existing)
        itemRefs.current.delete(noteId)
      }
    }
  }, [])

  // Determine which items should render content
  const shouldRenderContent = useCallback((noteId: string, index: number): boolean => {
    if (!enableVirtualization) return true
    // Always render first few items immediately
    if (index < overscan) return true
    // Render if visible or not yet observed (default to visible for SSR)
    return visibleItems[noteId] !== false
  }, [enableVirtualization, overscan, visibleItems])

  // Render placeholder for off-screen items
  const renderPlaceholder = useMemo(() => (
    <div
      className="bg-gray-800/30 rounded-lg animate-pulse"
      style={{ height: itemHeight, minHeight: itemHeight }}
      aria-hidden="true"
    />
  ), [itemHeight])

  return (
    <div className={className}>
      <div className="space-y-4">
        {notes.map((note, index) => (
          <div
            key={note.id}
            ref={(el) => setItemRef(note.id, el)}
            data-note-id={note.id}
            style={{ minHeight: enableVirtualization ? itemHeight : undefined }}
          >
            {shouldRenderContent(note.id, index) ? (
              children(note, index)
            ) : (
              renderPlaceholder
            )}
          </div>
        ))}
      </div>
    </div>
  )
}