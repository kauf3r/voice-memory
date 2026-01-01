'use client'

import { useState, useEffect } from 'react'
import { useIntersectionObserver } from '@/lib/hooks/use-intersection-observer'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
  placeholder?: string
  onLoad?: () => void
  onError?: (error: Error) => void
}

export default function LazyImage({
  src,
  alt,
  className = '',
  width,
  height,
  placeholder,
  onLoad,
  onError
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [loading, setLoading] = useState(false)

  const { elementRef, hasIntersected } = useIntersectionObserver({
    triggerOnce: true,
    rootMargin: '50px',
  })

  useEffect(() => {
    if (hasIntersected && !imageSrc && !loading) {
      loadImage()
    }
  }, [hasIntersected, imageSrc, loading])

  const loadImage = () => {
    setLoading(true)
    setImageError(false)

    const img = new Image()
    
    img.onload = () => {
      setImageSrc(src)
      setImageLoaded(true)
      setLoading(false)
      onLoad?.()
    }

    img.onerror = () => {
      setImageError(true)
      setLoading(false)
      onError?.(new Error(`Failed to load image: ${src}`))
    }

    img.src = src
  }

  const containerStyle = {
    width: width ? `${width}px` : undefined,
    height: height ? `${height}px` : undefined,
  }

  return (
    <div 
      ref={elementRef}
      className={`relative overflow-hidden ${className}`}
      style={containerStyle}
    >
      {/* Placeholder while loading */}
      {!imageLoaded && !imageError && (
        <div 
          className="absolute inset-0 bg-gray-200 flex items-center justify-center"
          style={containerStyle}
        >
          {loading ? (
            <div className="animate-pulse">
              <svg 
                className="w-8 h-8 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                />
              </svg>
            </div>
          ) : placeholder ? (
            <img 
              src={placeholder} 
              alt={alt}
              className="w-full h-full object-cover opacity-50"
            />
          ) : (
            <div className="text-gray-400 text-sm">Loading...</div>
          )}
        </div>
      )}

      {/* Error state */}
      {imageError && (
        <div 
          className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center text-gray-500"
          style={containerStyle}
        >
          <svg 
            className="w-8 h-8 mb-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" 
            />
          </svg>
          <span className="text-xs">Failed to load</span>
          <button 
            onClick={loadImage}
            className="mt-1 text-xs text-blue-600 hover:text-blue-700 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Actual image */}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          className={`transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          width={width}
          height={height}
          onLoad={() => setImageLoaded(true)}
        />
      )}
    </div>
  )
}

// Utility component for avatar images with fallbacks
export function LazyAvatar({
  src,
  name,
  size = 40,
  className = ''
}: {
  src?: string
  name: string
  size?: number
  className?: string
}) {
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (!src) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-300 text-gray-700 font-medium rounded-full ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initials}
      </div>
    )
  }

  return (
    <LazyImage
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      onError={() => {
        // Could implement fallback to initials here
      }}
    />
  )
}