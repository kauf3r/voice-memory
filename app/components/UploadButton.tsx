'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
const CHUNK_SIZE = 1024 * 1024 // 1MB per chunk

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
  const activeUploadsRef = useRef<Set<XMLHttpRequest>>(new Set())
  const { user } = useAuth()

  // Cleanup function for component unmount
  useEffect(() => {
    return () => {
      // Cancel all active uploads on unmount
      activeUploadsRef.current.forEach(xhr => {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          xhr.abort()
        }
      })
      activeUploadsRef.current.clear()
    }
  }, [])

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

  const uploadFileChunked = useCallback(async (file: File) => {
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

    try {
      // Get the current session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (!session) {
        console.error('No session found')
        throw new Error('No active session. Please log in again.')
      }
      
      console.log('Starting chunked upload for:', file.name, `(${(file.size / 1024 / 1024).toFixed(1)}MB)`)
      
      // Use direct upload with real progress tracking
      const result = await uploadFileDirectly(file, session.access_token, fileId)
      if (result.success) {
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
      }
      
    } catch (error) {
      console.error('Upload error caught:', error)
      setUploadProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[fileId]
        return newProgress
      })
      setError(error instanceof Error ? error.message : 'Upload failed')
    }
  }, [user, validateFile, onUploadStart, onUploadComplete])
  
  const uploadFileDirectly = useCallback(async (file: File, accessToken: string, fileId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    
    // Create XMLHttpRequest for real progress tracking
    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      
      // Track this upload
      activeUploadsRef.current.add(xhr)
      
      // Cleanup function
      const cleanup = () => {
        activeUploadsRef.current.delete(xhr)
      }
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100
          setUploadProgress(prev => ({ ...prev, [fileId]: Math.min(progress, 99) }))
        }
      })
      
      xhr.addEventListener('load', () => {
        cleanup()
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText)
            resolve(result)
          } catch (error) {
            reject(new Error('Server response was invalid'))
          }
        } else {
          let errorData
          try {
            errorData = JSON.parse(xhr.responseText)
          } catch {
            errorData = { error: 'Upload failed' }
          }
          
          if (xhr.status === 413) {
            reject(new Error(
              errorData.details || 
              `File too large. Maximum size is ${errorData.maxSizeMB || 25}MB.`
            ))
          } else if (xhr.status === 507) {
            reject(new Error(
              errorData.details || 
              `Storage quota exceeded.`
            ))
          } else {
            reject(new Error(errorData.error || 'Upload failed'))
          }
        }
      })
      
      xhr.addEventListener('error', () => {
        cleanup()
        reject(new Error('Network error during upload'))
      })
      
      xhr.addEventListener('timeout', () => {
        cleanup()
        reject(new Error('Upload timed out. Please try again.'))
      })
      
      xhr.addEventListener('abort', () => {
        cleanup()
        reject(new Error('Upload was cancelled'))
      })
      
      xhr.timeout = 60000 // 60 second timeout for direct uploads
      xhr.open('POST', '/api/upload')
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
      xhr.send(formData)
    })
  }, [])
  
  const uploadFile = uploadFileDirectly

  const handleFiles = useCallback(async (files: FileList) => {
    setIsUploading(true)
    
    const fileArray = Array.from(files)
    
    if (multiple) {
      // Upload files sequentially to avoid overwhelming browser memory
      for (const file of fileArray) {
        await uploadFileChunked(file)
      }
    } else {
      // Upload single file
      if (fileArray.length > 0) {
        await uploadFileChunked(fileArray[0])
      }
    }
    
    setIsUploading(false)
  }, [uploadFileChunked, multiple])

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
        id="audio-file-upload"
        name="audio-files"
        accept={ACCEPTED_AUDIO_TYPES.join(',')}
        multiple={multiple}
        onChange={handleFileInput}
        className="hidden"
        aria-label="Upload audio files"
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