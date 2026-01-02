'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from './LoadingSpinner'
import ErrorMessage from './ErrorMessage'
import { Loader } from '@/components/ai-elements/loader'
import { Response } from '@/components/ai-elements/response'
import { needsConversion, convertToMp3 } from '@/lib/client-audio-converter'

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
  const [isConverting, setIsConverting] = useState(false)
  const [conversionProgress, setConversionProgress] = useState(0)
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

  /**
   * Upload file using signed URL flow to bypass Vercel body size limits.
   * Flow: Get signed URL -> Upload directly to Supabase Storage -> Create note record
   */
  const uploadWithSignedUrl = useCallback(async (file: File, accessToken: string, fileId: string): Promise<any> => {
    // Step 1: Get signed upload URL from our API
    console.log('Step 1: Getting signed upload URL...')
    const signedUrlResponse = await fetch(`/api/upload/signed-url?filename=${encodeURIComponent(file.name)}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!signedUrlResponse.ok) {
      const errorData = await signedUrlResponse.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to get upload URL')
    }

    const { signedUrl, token, filePath, publicUrl } = await signedUrlResponse.json()
    console.log('Got signed URL for path:', filePath)

    // Step 2: Upload directly to Supabase Storage with progress tracking
    console.log('Step 2: Uploading directly to Supabase Storage...')
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      activeUploadsRef.current.add(xhr)
      const cleanup = () => activeUploadsRef.current.delete(xhr)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          // Reserve last 5% for note creation
          const progress = (e.loaded / e.total) * 95
          setUploadProgress(prev => ({ ...prev, [fileId]: Math.min(progress, 95) }))
        }
      })

      xhr.addEventListener('load', () => {
        cleanup()
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('Direct upload to storage successful')
          resolve()
        } else {
          console.error('Storage upload failed:', xhr.status, xhr.responseText)
          reject(new Error(`Storage upload failed: ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => {
        cleanup()
        reject(new Error('Network error during storage upload'))
      })

      xhr.addEventListener('timeout', () => {
        cleanup()
        reject(new Error('Storage upload timed out'))
      })

      xhr.addEventListener('abort', () => {
        cleanup()
        reject(new Error('Upload was cancelled'))
      })

      xhr.timeout = 300000 // 5 minutes for large files
      xhr.open('PUT', signedUrl)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg')
      xhr.send(file)
    })

    // Step 3: Create note record via our API
    console.log('Step 3: Creating note record...')
    setUploadProgress(prev => ({ ...prev, [fileId]: 98 }))

    const noteResponse = await fetch('/api/upload/create-note', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioUrl: publicUrl,
        filePath: filePath,
        fileSize: file.size
      })
    })

    if (!noteResponse.ok) {
      const errorData = await noteResponse.json().catch(() => ({}))
      throw new Error(errorData.error || 'Failed to create note record')
    }

    const result = await noteResponse.json()
    console.log('Note created successfully:', result.note?.id)

    return result
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

      // Convert M4A files to MP3 for reliable Whisper compatibility
      let fileToUpload = file
      if (needsConversion(file)) {
        console.log(`🔄 M4A file detected, converting to MP3 for better compatibility...`)
        setIsConverting(true)
        setConversionProgress(0)

        try {
          fileToUpload = await convertToMp3(file, (progress) => {
            setConversionProgress(progress)
          })
          console.log(`✅ Conversion complete: ${file.name} → ${fileToUpload.name}`)
        } catch (conversionError) {
          console.warn('⚠️ Conversion failed, uploading original file:', conversionError)
          // Fall back to original file if conversion fails
          fileToUpload = file
        } finally {
          setIsConverting(false)
          setConversionProgress(0)
        }
      }

      console.log('Starting signed URL upload for:', fileToUpload.name, `(${(fileToUpload.size / 1024 / 1024).toFixed(1)}MB)`)

      // Use signed URL upload flow (bypasses Vercel body size limits)
      const result = await uploadWithSignedUrl(fileToUpload, session.access_token, fileId)
      if (result.success) {
        console.log('Upload completed successfully, note ID:', result.note?.id)
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
  }, [user, validateFile, onUploadStart, onUploadComplete, uploadWithSignedUrl])

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
        {isConverting ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <Loader size={32} className="mr-3" />
            </div>
            <div>
              <Response className="text-sm font-medium text-gray-900 text-center">
                **Converting Audio Format**

                Optimizing M4A file for best transcription quality...
              </Response>
              <div className="mt-4">
                <div className="bg-gray-200 rounded-full h-2 w-full max-w-xs mx-auto">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${conversionProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {Math.round(conversionProgress)}% • Converting to MP3
                </p>
              </div>
            </div>
          </div>
        ) : isUploading ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <Loader size={32} className="mr-3" />
            </div>
            <div>
              <Response className="text-sm font-medium text-gray-900 text-center">
                **Uploading Your Voice Note**

                Preparing your audio file for AI analysis...
              </Response>
              {hasActiveUploads && (
                <div className="mt-4">
                  <div className="bg-gray-200 rounded-full h-2 w-full max-w-xs mx-auto">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${averageProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    {Math.round(averageProgress)}% complete • Upload will complete shortly
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <Response className="text-red-700">
              **Upload Error**
              
              {error}
              
              *Try uploading again or check your file format and size.*
            </Response>
            <button
              onClick={() => setError(null)}
              className="mt-3 text-sm text-red-600 hover:text-red-700 underline"
            >
              Dismiss and try again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}