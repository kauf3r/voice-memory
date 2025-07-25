import { supabase } from './supabase'
import { SupabaseClient } from '@supabase/supabase-js'

const AUDIO_BUCKET = 'audio-files'

export async function uploadAudioFile(
  file: File,
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<{ url: string | null; error: Error | null }> {
  try {
    // Use provided client or fallback to default
    const client = supabaseClient || supabase
    
    // Create unique filename
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = `${timestamp}.${fileExt}`
    const filePath = `${userId}/${fileName}`

    // Upload file
    const { error: uploadError } = await client.storage
      .from(AUDIO_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL (with signed URL for privacy)
    const { data } = client.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(filePath)

    return { url: data.publicUrl, error: null }
  } catch (error) {
    return { url: null, error: error as Error }
  }
}

export async function getSignedAudioUrl(
  filePath: string
): Promise<{ url: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(filePath, 3600) // 1 hour expiry

    if (error) throw error

    return { url: data?.signedUrl || null, error: null }
  } catch (error) {
    return { url: null, error: error as Error }
  }
}

export async function deleteAudioFile(
  filePath: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .remove([filePath])

    if (error) throw error

    return { error: null }
  } catch (error) {
    return { error: error as Error }
  }
}

// Centralized storage utilities for the Voice Memory application

/**
 * Extract file path from Supabase storage URL
 */
export function getFilePathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    const bucketIndex = pathParts.indexOf('audio-files')
    if (bucketIndex === -1) return ''
    
    return pathParts.slice(bucketIndex + 1).join('/')
  } catch (error) {
    console.error('Error extracting file path from URL:', url, error)
    return ''
  }
}

/**
 * Determine MIME type from file extension and optionally magic bytes
 * Standardizes M4A/MP4 audio container detection for consistent processing
 */
export function getMimeTypeFromUrl(url: string, magicBytes?: Uint8Array): string {
  const extension = url.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',  // Standardize M4A as audio/mp4 for Whisper compatibility
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'webm': 'audio/webm',
    'mp4': 'audio/mp4'   // Could be audio or video - magic bytes will determine
  }

  // If we have magic bytes, use them for more accurate detection
  if (magicBytes && magicBytes.length >= 12) {
    // Check for MP4/M4A container (starts with ftyp box)
    if (magicBytes[4] === 0x66 && magicBytes[5] === 0x74 && magicBytes[6] === 0x79 && magicBytes[7] === 0x70) {
      // Check ftyp brand to distinguish audio vs video MP4 containers
      const brandBytes = magicBytes.slice(8, 12)
      const brand = String.fromCharCode(...brandBytes)
      
      // M4A audio container brands
      if (brand === 'M4A ' || brand === 'M4B ' || brand === 'mp41' || brand === 'mp42') {
        return 'audio/mp4'  // Confirmed M4A audio container
      }
      // Video MP4 brands
      else if (brand === 'isom' || brand === 'avc1' || brand === 'mp41' || brand === 'MSNV') {
        return extension === 'm4a' ? 'audio/mp4' : 'video/mp4'  // Respect original extension intent
      }
      // Default to audio/mp4 for M4A files, video/mp4 for MP4 files
      return extension === 'm4a' ? 'audio/mp4' : (extension === 'mp4' ? 'video/mp4' : 'audio/mp4')
    }
    // Check for MP3 format (ID3 tag or MPEG frame sync)
    else if ((magicBytes[0] === 0x49 && magicBytes[1] === 0x44 && magicBytes[2] === 0x33) || // ID3v2
             (magicBytes[0] === 0xFF && (magicBytes[1] & 0xE0) === 0xE0)) { // MPEG frame sync
      return 'audio/mpeg'
    }
    // Check for WAV format
    else if (magicBytes[0] === 0x52 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46 && magicBytes[3] === 0x46) {
      return 'audio/wav'
    }
  }

  return mimeTypes[extension || ''] || 'audio/mpeg'
}

/**
 * Create a Node.js compatible File object for server environments using Buffer
 * This is the most robust approach for OpenAI API compatibility
 */
export function createServerFileFromBuffer(buffer: Buffer, filename: string, mimeType: string): File {
  // Create a robust File-like object that's fully compatible with OpenAI SDK
  const fileObject = {
    name: filename,
    type: mimeType,
    size: buffer.length,
    
    // Convert buffer to ArrayBuffer for OpenAI API
    arrayBuffer: async (): Promise<ArrayBuffer> => {
      const arrayBuffer = new ArrayBuffer(buffer.length)
      const view = new Uint8Array(arrayBuffer)
      for (let i = 0; i < buffer.length; i++) {
        view[i] = buffer[i]
      }
      return arrayBuffer
    },
    
    // Create a ReadableStream from buffer
    stream: (): ReadableStream<Uint8Array> => {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(buffer))
          controller.close()
        }
      })
    },
    
    // Convert to text (mainly for debugging)
    text: async (): Promise<string> => {
      return buffer.toString('utf-8')
    },
    
    // Slice operation for partial reads
    slice: (start?: number, end?: number, contentType?: string): File => {
      const sliceStart = start || 0
      const sliceEnd = end || buffer.length
      const slicedBuffer = buffer.slice(sliceStart, sliceEnd)
      return createServerFileFromBuffer(slicedBuffer, filename, contentType || mimeType)
    },
    
    // Additional File interface properties
    lastModified: Date.now(),
    webkitRelativePath: '',
    
    // Add bytes method that some environments might expect
    bytes: async (): Promise<Uint8Array> => {
      return new Uint8Array(buffer)
    }
  }
  
  // Try to use File prototype if available for maximum compatibility
  if (typeof File !== 'undefined' && File.prototype) {
    try {
      Object.setPrototypeOf(fileObject, File.prototype)
    } catch (error) {
      // Ignore prototype setting errors in some environments
      console.debug('Could not set File prototype, using object as-is')
    }
  }
  
  return fileObject as unknown as File
}

/**
 * Create a Node.js compatible File object for server environments
 * This handles the File constructor compatibility issues in serverless functions
 * @deprecated Use createServerFileFromBuffer for better compatibility
 */
export function createServerFile(blob: Blob, filename: string, mimeType: string): File {
  // In Node.js environments, we need to handle File constructor differently
  if (typeof window === 'undefined') {
    // Server-side: Use a more compatible approach
    try {
      // Try the standard File constructor first
      return new File([blob], filename, { type: mimeType })
    } catch (error) {
      // Fallback: Create a File-like object that works with OpenAI API
      const fileLike = {
        name: filename,
        type: mimeType,
        size: blob.size,
        arrayBuffer: () => blob.arrayBuffer(),
        stream: () => blob.stream(),
        text: () => blob.text(),
        slice: (start?: number, end?: number, contentType?: string) => 
          createServerFile(blob.slice(start, end, contentType), filename, mimeType),
        lastModified: Date.now(),
        webkitRelativePath: '',
        bytes: async (): Promise<Uint8Array> => {
          const arrayBuffer = await blob.arrayBuffer()
          return new Uint8Array(arrayBuffer)
        }
      }
      
      // Add File prototype methods if available
      if (typeof File !== 'undefined') {
        Object.setPrototypeOf(fileLike, File.prototype)
      }
      
      return fileLike as unknown as File
    }
  } else {
    // Client-side: Use standard File constructor
    return new File([blob], filename, { type: mimeType })
  }
}

/**
 * Enhanced File creation with validation for OpenAI API compatibility
 */
export function createValidatedServerFile(
  data: Buffer | Blob | ArrayBuffer, 
  filename: string, 
  mimeType: string
): { file: File; isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Validate inputs
  if (!filename || filename.trim().length === 0) {
    errors.push('Filename cannot be empty')
  }
  
  if (!mimeType || !mimeType.includes('/')) {
    errors.push('Invalid MIME type format')
  }
  
  if (!data) {
    errors.push('No data provided')
    return { file: null as any, isValid: false, errors }
  }
  
  let buffer: Buffer
  
  // Convert input to Buffer
  if (Buffer.isBuffer(data)) {
    buffer = data
  } else if (data instanceof ArrayBuffer) {
    buffer = Buffer.from(data)
  } else if (data instanceof Blob) {
    // For Blob, we'll need to convert it asynchronously
    // This is a synchronous function, so we'll create a File that handles the conversion
    return {
      file: createServerFile(data, filename, mimeType),
      isValid: errors.length === 0,
      errors
    }
  } else {
    errors.push('Unsupported data type')
    return { file: null as any, isValid: false, errors }
  }
  
  // Check buffer size
  if (buffer.length === 0) {
    errors.push('File cannot be empty')
  }
  
  if (buffer.length > 25 * 1024 * 1024) { // 25MB OpenAI limit
    errors.push('File size exceeds OpenAI limit of 25MB')
  }
  
  // Create the file
  const file = createServerFileFromBuffer(buffer, filename, mimeType)
  
  return {
    file,
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate audio file format and size
 */
export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 25 * 1024 * 1024 // 25MB
  const allowedTypes = [
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/aac',
    'audio/ogg',
    'audio/webm'
  ]

  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 25MB limit' }
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Unsupported audio format' }
  }

  return { valid: true }
}

/**
 * Generate a unique filename for audio uploads
 */
export function generateAudioFilename(originalName: string, userId: string): string {
  const timestamp = Date.now()
  const extension = originalName.split('.').pop() || 'mp3'
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_')
  
  return `${userId}/${timestamp}_${sanitizedName}.${extension}`
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm'
  }
  
  return mimeToExt[mimeType] || 'mp3'
}