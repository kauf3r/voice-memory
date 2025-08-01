'use client'

import { useState, useRef, useCallback } from 'react'
import { useAuth } from './AuthProvider'
import { uploadAudioFile } from '@/lib/storage'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from './LoadingSpinner'
import ErrorMessage from './ErrorMessage'

interface UploadButtonProps {
  onUploadComplete?: () => void
  onUploadStart?: (file: File) => void
  className?: string
  multiple?: boolean
}

const ACCEPTED_AUDIO_TYPES = [
  // Audio formats
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/m4a',      // M4A audio container
  'audio/mp4',      // M4A files reported as audio/mp4
  'audio/x-m4a',    // Alternative M4A MIME type
  'audio/aac',
  'audio/ogg',
  'audio/webm',
  // Video formats (audio will be extracted)
  'video/mp4',      // MP4 video files
  'video/quicktime', // .mov files
  'video/x-msvideo', // .avi files
  'video/webm',     // WebM video files
]

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

export default function UploadButton({
  onUploadComplete,
  onUploadStart,
  className = '',
  multiple = true,
}: UploadButtonProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()

  const validateFile = useCallback((file: File): string | null => {
    // Enhanced validation with M4A special handling
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    
    // Special handling for M4A files that might have unexpected MIME types
    if (fileExtension === 'm4a') {
      // Accept M4A files regardless of MIME type reported by browser
      console.log(`M4A file detected: ${file.name}, MIME type: ${file.type}`)
    } else if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
      return `File type "${file.type}" is not supported. Please upload an audio file (MP3, M4A, WAV, AAC, OGG) or video file (MP4, MOV, AVI, WebM).`
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 25MB limit.`
    }
    return null
  }, [])

  const uploadFile = useCallback(async (file: File) => {
    if (!user) {
      setError('You must be logged in to upload files.')
      return
    }

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    onUploadStart?.(file)
    
    // Initialize progress tracking
    const fileId = `${file.name}-${Date.now()}`
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))

    // Initialize progress interval outside try block so it's accessible in catch
    let progressInterval: NodeJS.Timeout | null = null

    try {
      // Create FormData for the upload
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress updates
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const currentProgress = prev[fileId] || 0
          if (currentProgress >= 95) {
            if (progressInterval) clearInterval(progressInterval)
            return prev
          }
          return { ...prev, [fileId]: currentProgress + 10 }
        })
      }, 200)

      // Get the current session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (!session) {
        console.error('No session found')
        throw new Error('No active session. Please log in again.')
      }
      
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        controller.abort()
        console.error('Upload timeout after 30 seconds')
      }, 30000) // 30 second timeout
      
      console.log('Starting upload request for:', file.name)
      
      // Upload via API route
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        signal: controller.signal
      }).catch(error => {
        clearTimeout(timeoutId)
        if (error.name === 'AbortError') {
          throw new Error('Upload timed out. Please try again.')
        }
        throw error
      })
      
      clearTimeout(timeoutId)
      console.log('Upload response received:', response.status, response.statusText)

      if (progressInterval) clearInterval(progressInterval)
      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }))

      if (!response.ok) {
        console.error('Upload failed with status:', response.status)
        let errorData
        try {
          errorData = await response.json()
          console.error('Error data:', errorData)
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          errorData = { error: 'Failed to parse server response' }
        }
        
        // Enhanced error handling with more details
        if (response.status === 413) {
          // File too large
          throw new Error(
            errorData.details || 
            `File too large. Maximum size is ${errorData.maxSizeMB || 25}MB. Your file is ${errorData.currentSizeMB}MB.`
          )
        } else if (response.status === 507) {
          // Storage quota exceeded
          throw new Error(
            errorData.details || 
            `Storage quota exceeded. You have ${errorData.currentCount}/${errorData.maxCount} notes.`
          )
        } else {
          throw new Error(errorData.error || 'Upload failed')
        }
      }

      console.log('Parsing successful response...')
      let result
      try {
        result = await response.json()
        console.log('Upload result:', result)
      } catch (parseError) {
        console.error('Failed to parse success response:', parseError)
        throw new Error('Server response was invalid')
      }
      
      if (result.success && result.url) {
        console.log('Upload completed successfully, URL:', result.url)
        onUploadComplete?.()
        
        // Clean up progress after a delay
        setTimeout(() => {
          setUploadProgress(prev => {
            const newProgress = { ...prev }
            delete newProgress[fileId]
            return newProgress
          })
        }, 2000)
      } else {
        throw new Error('Upload response was invalid')
      }
    } catch (error) {
      console.error('Upload error caught:', error)
      if (progressInterval) clearInterval(progressInterval)
      setUploadProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[fileId]
        return newProgress
      })
      setError(error instanceof Error ? error.message : 'Upload failed')
    }
  }, [user, validateFile, onUploadStart, onUploadComplete])

  const handleFiles = useCallback(async (files: FileList) => {
    setIsUploading(true)
    
    const fileArray = Array.from(files)
    
    if (multiple) {
      // Upload files in parallel
      await Promise.all(fileArray.map(uploadFile))
    } else {
      // Upload single file
      if (fileArray.length > 0) {
        await uploadFile(fileArray[0])
      }
    }
    
    setIsUploading(false)
  }, [uploadFile, multiple])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }, [handleFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const progressValues = Object.values(uploadProgress)
  const hasActiveUploads = progressValues.length > 0
  const averageProgress = hasActiveUploads 
    ? progressValues.reduce((sum, progress) => sum + progress, 0) / progressValues.length 
    : 0

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_AUDIO_TYPES.join(',')}
        multiple={multiple}
        onChange={handleFileInput}
        className="hidden"
      />

      <div
        onClick={openFileDialog}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
          ${isDragging 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${isUploading ? 'cursor-not-allowed opacity-75' : ''}
        `}
      >
        {isUploading ? (
          <div className="space-y-4">
            <LoadingSpinner size="lg" />
            <div>
              <p className="text-sm font-medium text-gray-900">Uploading...</p>
              {hasActiveUploads && (
                <div className="mt-2">
                  <div className="bg-gray-200 rounded-full h-2 w-full max-w-xs mx-auto">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${averageProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round(averageProgress)}% complete
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto h-12 w-12">
              <svg
                className="h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {isDragging ? 'Drop your audio files here' : 'Upload audio files'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Drag and drop or click to browse
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Supports MP3, WAV, M4A, AAC, OGG (max 25MB each)
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorMessage
            message={error}
            onRetry={() => setError(null)}
          />
        </div>
      )}
    </div>
  )
}