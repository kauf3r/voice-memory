'use client'

import { useEffect, useRef, useState } from 'react'

interface UseIntersectionObserverOptions {
  threshold?: number
  rootMargin?: string
  triggerOnce?: boolean
}

export function useIntersectionObserver<T extends HTMLElement = HTMLDivElement>(
  options: UseIntersectionObserverOptions = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [hasIntersected, setHasIntersected] = useState(false)
  const elementRef = useRef<T | null>(null)

  const { threshold = 0.1, rootMargin = '50px', triggerOnce = false } = options

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isElementIntersecting = entry.isIntersecting
        setIsIntersecting(isElementIntersecting)
        
        if (isElementIntersecting && !hasIntersected) {
          setHasIntersected(true)
        }
      },
      {
        threshold,
        rootMargin,
      }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [threshold, rootMargin, hasIntersected])

  return {
    elementRef,
    isIntersecting,
    hasIntersected: triggerOnce ? hasIntersected : isIntersecting,
  }
}

// Hook specifically for infinite scroll
export function useInfiniteScroll(
  loadMore: () => Promise<void>,
  hasMore: boolean,
  loading: boolean
) {
  const { elementRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px',
  })

  useEffect(() => {
    if (isIntersecting && hasMore && !loading) {
      loadMore()
    }
  }, [isIntersecting, hasMore, loading, loadMore])

  return elementRef
}