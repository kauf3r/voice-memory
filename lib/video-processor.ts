/**
 * Video Processing Module for Voice Memory
 * 
 * Handles video file detection and audio extraction for transcription.
 * Supports common video formats: MP4, MOV, AVI, WebM, MKV
 */

import { createServerFileFromBuffer } from './storage'

export interface VideoProcessingResult {
  success: boolean
  audioBuffer?: Buffer
  audioMimeType?: string
  error?: string
  metadata?: {
    originalFormat: string
    duration?: number
    hasAudio: boolean
    videoCodec?: string
    audioCodec?: string
  }
}

export interface VideoMetadata {
  format: string
  duration?: number
  hasAudio: boolean
  hasVideo: boolean
  videoCodec?: string
  audioCodec?: string
  bitrate?: number
  sampleRate?: number
}

/**
 * Detect if a file is a video file based on MIME type and extension
 */
export function isVideoFile(mimeType: string, filename: string): boolean {
  const videoMimeTypes = [
    'video/mp4',
    'video/quicktime',  // .mov
    'video/x-msvideo',  // .avi
    'video/webm',
    'video/x-matroska', // .mkv
    'video/x-flv',      // .flv
    'video/x-ms-wmv',   // .wmv
  ]
  
  const extension = filename.split('.').pop()?.toLowerCase()
  const videoExtensions = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv', 'wmv']
  
  return videoMimeTypes.includes(mimeType) || 
         (extension ? videoExtensions.includes(extension) : false)
}

/**
 * Check if video processing dependencies are available
 */
export async function checkVideoProcessingCapabilities(): Promise<{
  ffmpegAvailable: boolean
  supportedFormats: string[]
  error?: string
}> {
  // In a production environment, you would check for FFmpeg installation
  // For now, we'll implement a basic capability check
  
  try {
    // Check if we're in a serverless environment that supports video processing
    const isVercel = process.env.VERCEL === '1'
    const isAWS = process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined
    
    if (isVercel || isAWS) {
      // Serverless environments typically don't have FFmpeg by default
      return {
        ffmpegAvailable: false,
        supportedFormats: [],
        error: 'FFmpeg not available in serverless environment. Video processing requires a server with FFmpeg installed.'
      }
    }
    
    // In a regular server environment, we would check for FFmpeg
    // For development/testing, we'll simulate availability
    return {
      ffmpegAvailable: process.env.NODE_ENV === 'development',
      supportedFormats: ['mp4', 'mov', 'avi', 'webm'],
      error: process.env.NODE_ENV !== 'development' ? 'FFmpeg not configured for production' : undefined
    }
  } catch (error) {
    return {
      ffmpegAvailable: false,
      supportedFormats: [],
      error: `Error checking video processing capabilities: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Extract basic metadata from video file buffer
 */
export function extractVideoMetadata(buffer: Buffer, filename: string): VideoMetadata {
  const extension = filename.split('.').pop()?.toLowerCase() || 'unknown'
  
  // Basic metadata extraction based on file headers
  // In a full implementation, you would use a proper media library
  
  const metadata: VideoMetadata = {
    format: extension,
    hasAudio: true,  // Assume most video files have audio
    hasVideo: true,
  }
  
  // Check for MP4 container
  if (buffer.length >= 12 && 
      buffer[4] === 0x66 && buffer[5] === 0x74 && 
      buffer[6] === 0x79 && buffer[7] === 0x70) {
    
    const brand = buffer.slice(8, 12).toString('ascii')
    metadata.videoCodec = brand.includes('avc') ? 'H.264' : 'unknown'
    
    // For MP4, we can make educated guesses about audio presence
    metadata.hasAudio = !brand.includes('vide') // 'vide' brand typically means video-only
  }
  
  return metadata
}

/**
 * Process video file to extract audio for transcription
 * 
 * Phase 1: Detect video files and provide helpful error messages
 * Phase 2: Implement actual audio extraction using FFmpeg
 */
export async function processVideoFile(
  buffer: Buffer, 
  filename: string, 
  mimeType: string
): Promise<VideoProcessingResult> {
  
  console.log(`Processing video file: ${filename} (${mimeType}, ${buffer.length} bytes)`)
  
  try {
    // Extract basic metadata
    const metadata = extractVideoMetadata(buffer, filename)
    console.log('Video metadata:', metadata)
    
    // Check if video processing is available
    const capabilities = await checkVideoProcessingCapabilities()
    console.log('Video processing capabilities:', capabilities)
    
    if (!capabilities.ffmpegAvailable) {
      return {
        success: false,
        error: `Video processing not available: ${capabilities.error}. Please convert your video to audio format (MP3, M4A, WAV) before uploading.`,
        metadata: {
          originalFormat: metadata.format,
          hasAudio: metadata.hasAudio,
          videoCodec: metadata.videoCodec,
          audioCodec: metadata.audioCodec
        }
      }
    }
    
    // Phase 2: Implement actual FFmpeg audio extraction
    // For now, return an informative error with instructions
    return {
      success: false,
      error: `Video file detected but audio extraction not yet implemented. Please convert ${filename} to an audio format (MP3, M4A, WAV) and upload again.`,
      metadata: {
        originalFormat: metadata.format,
        duration: metadata.duration,
        hasAudio: metadata.hasAudio,
        videoCodec: metadata.videoCodec,
        audioCodec: metadata.audioCodec
      }
    }
    
  } catch (error) {
    console.error('Video processing error:', error)
    return {
      success: false,
      error: `Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: {
        originalFormat: filename.split('.').pop()?.toLowerCase() || 'unknown',
        hasAudio: false
      }
    }
  }
}

/**
 * Future implementation: Extract audio from video using FFmpeg
 * This would be implemented in Phase 2 when FFmpeg is available
 */
async function extractAudioWithFFmpeg(
  videoBuffer: Buffer, 
  outputFormat: 'mp3' | 'wav' | 'm4a' = 'mp3'
): Promise<{ audioBuffer: Buffer; mimeType: string }> {
  // Placeholder for FFmpeg implementation
  // This would use child_process to run FFmpeg commands
  // ffmpeg -i input.mp4 -vn -acodec mp3 -ab 128k output.mp3
  
  throw new Error('FFmpeg audio extraction not yet implemented')
}

/**
 * Get recommended audio extraction settings for different video formats
 */
export function getAudioExtractionSettings(videoFormat: string): {
  outputFormat: 'mp3' | 'wav' | 'm4a'
  bitrate: string
  sampleRate: string
} {
  const formatSettings = {
    'mp4': { outputFormat: 'm4a' as const, bitrate: '128k', sampleRate: '44100' },
    'mov': { outputFormat: 'm4a' as const, bitrate: '128k', sampleRate: '44100' },
    'avi': { outputFormat: 'mp3' as const, bitrate: '128k', sampleRate: '44100' },
    'webm': { outputFormat: 'mp3' as const, bitrate: '128k', sampleRate: '44100' },
    'mkv': { outputFormat: 'mp3' as const, bitrate: '128k', sampleRate: '44100' },
  }
  
  return (formatSettings as any)[videoFormat] || { outputFormat: 'mp3', bitrate: '128k', sampleRate: '44100' }
}