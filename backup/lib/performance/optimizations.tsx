'use client'

import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react'

// Enhanced React.memo with debugging
export function createMemoComponent<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  propsAreEqual?: (prevProps: T, nextProps: T) => boolean,
  debugName?: string
) {
  const MemoizedComponent = memo(Component, (prevProps, nextProps) => {
    if (propsAreEqual) {
      const areEqual = propsAreEqual(prevProps, nextProps)
      if (debugName && !areEqual) {
        console.log(`🔄 ${debugName} re-rendering due to prop changes:`, {
          prevProps,
          nextProps
        })
      }
      return areEqual
    }
    return false
  })

  MemoizedComponent.displayName = debugName || Component.displayName || Component.name
  return MemoizedComponent
}

// Performance-aware useState hook
export function usePerformantState<T>(
  initialValue: T,
  equalityFn?: (prev: T, next: T) => boolean
) {
  const [state, setState] = React.useState(initialValue)
  const setStateCallback = useCallback((newValue: T | ((prev: T) => T)) => {
    setState(prevState => {
      const nextState = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(prevState)
        : newValue

      if (equalityFn && equalityFn(prevState, nextState)) {
        return prevState // Prevent unnecessary re-renders
      }
      
      return nextState
    })
  }, [equalityFn])

  return [state, setStateCallback] as const
}

// Debounced value hook for performance
export function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Throttled callback hook
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now())
  
  return useCallback((...args: Parameters<T>) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args)
      lastRun.current = Date.now()
    }
  }, [callback, delay]) as T
}

// Virtual list component for large datasets
interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  className?: string
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = ''
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleScroll = useThrottledCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, 16) // ~60fps

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan])

  const visibleItems = useMemo(() => {
    const result = []
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      result.push({
        index: i,
        item: items[i],
        offsetY: i * itemHeight
      })
    }
    return result
  }, [items, visibleRange.startIndex, visibleRange.endIndex, itemHeight])

  const totalHeight = items.length * itemHeight

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ index, item, offsetY }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: offsetY,
              left: 0,
              right: 0,
              height: itemHeight
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  )
}

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
) {
  const targetRef = useRef<HTMLElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (!targetRef.current) return

    observerRef.current = new IntersectionObserver(callback, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options
    })

    observerRef.current.observe(targetRef.current)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [callback, options])

  return targetRef
}

// Lazy loading component
interface LazyComponentProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  rootMargin?: string
  threshold?: number
  triggerOnce?: boolean
}

export function LazyComponent({
  children,
  fallback = null,
  rootMargin = '50px',
  threshold = 0.1,
  triggerOnce = true
}: LazyComponentProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [hasBeenVisible, setHasBeenVisible] = React.useState(false)

  const targetRef = useIntersectionObserver(
    (entries) => {
      const [entry] = entries
      setIsVisible(entry.isIntersecting)
      
      if (entry.isIntersecting && triggerOnce) {
        setHasBeenVisible(true)
      }
    },
    { rootMargin, threshold }
  )

  const shouldRender = triggerOnce ? hasBeenVisible : isVisible

  return (
    <div ref={targetRef}>
      {shouldRender ? children : fallback}
    </div>
  )
}

// Performance budget checker
interface PerformanceBudget {
  maxBundleSize?: number // in KB
  maxLCP?: number // in ms
  maxFID?: number // in ms
  maxCLS?: number
}

export function usePerformanceBudget(budget: PerformanceBudget) {
  const [violations, setViolations] = React.useState<string[]>([])

  useEffect(() => {
    const checkBudget = () => {
      const newViolations: string[] = []

      // Check bundle size (approximate)
      if (budget.maxBundleSize && window.performance) {
        const totalTransferSize = performance
          .getEntriesByType('resource')
          .reduce((total, resource) => {
            const timing = resource as PerformanceResourceTiming
            return total + (timing.transferSize || 0)
          }, 0)

        if (totalTransferSize / 1024 > budget.maxBundleSize) {
          newViolations.push(`Bundle size exceeds budget: ${(totalTransferSize / 1024).toFixed(1)}KB > ${budget.maxBundleSize}KB`)
        }
      }

      setViolations(newViolations)
    }

    // Check budget after page load
    if (document.readyState === 'complete') {
      checkBudget()
    } else {
      window.addEventListener('load', checkBudget)
      return () => window.removeEventListener('load', checkBudget)
    }
  }, [budget])

  return violations
}

// HOC for performance monitoring
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    name?: string
    trackRenders?: boolean
    trackProps?: boolean
  } = {}
) {
  const { name = WrappedComponent.name || 'Component', trackRenders = false, trackProps = false } = options

  return React.forwardRef<any, P>((props, ref) => {
    const renderCount = useRef(0)
    const lastProps = useRef<P | null>(null)

    useEffect(() => {
      renderCount.current++
      
      if (trackRenders) {
        console.log(`🎨 ${name} render #${renderCount.current}`)
      }

      if (trackProps && lastProps.current) {
        const changedProps = Object.keys(props as any).filter(
          key => (props as any)[key] !== (lastProps.current as any)?.[key]
        )
        
        if (changedProps.length > 0) {
          console.log(`📊 ${name} prop changes:`, changedProps)
        }
      }

      lastProps.current = props
    })

    const startTime = performance.now()
    const result = <WrappedComponent {...props} ref={ref} />
    const renderTime = performance.now() - startTime

    if (renderTime > 16) { // More than one frame at 60fps
      console.warn(`🐌 ${name} slow render: ${renderTime.toFixed(2)}ms`)
    }

    return result
  })
}

// Image optimization component
interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  priority?: boolean
  quality?: number
  sizes?: string
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
}

export function OptimizedImage({
  src,
  alt,
  priority = false,
  quality = 75,
  sizes,
  placeholder = 'empty',
  blurDataURL,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [error, setError] = React.useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const optimizedSrc = useMemo(() => {
    // Add quality and format parameters if using a service like Vercel
    const url = new URL(src, window.location.origin)
    url.searchParams.set('q', quality.toString())
    url.searchParams.set('f', 'webp')
    return url.toString()
  }, [src, quality])

  useEffect(() => {
    if (!imgRef.current || priority) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const img = imgRef.current
          if (img && !img.src) {
            img.src = optimizedSrc
          }
          observer.disconnect()
        }
      },
      { rootMargin: '50px' }
    )

    observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [optimizedSrc, priority])

  return (
    <img
      ref={imgRef}
      src={priority ? optimizedSrc : undefined}
      alt={alt}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      onLoad={() => setIsLoaded(true)}
      onError={() => setError(true)}
      style={{
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 0.3s ease',
        backgroundColor: placeholder === 'blur' ? '#f3f4f6' : 'transparent',
        backgroundImage: placeholder === 'blur' && blurDataURL ? `url(${blurDataURL})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        ...props.style
      }}
      {...props}
    />
  )
}