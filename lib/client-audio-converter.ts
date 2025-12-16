/**
 * Client-side audio conversion using FFmpeg WebAssembly
 * Converts M4A/MP4 audio files to MP3 for reliable Whisper API compatibility
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let ffmpegLoaded = false
let ffmpegLoading = false

/**
 * Initialize FFmpeg WebAssembly (lazy loaded)
 */
async function initFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpegLoaded) {
    return ffmpeg
  }

  if (ffmpegLoading) {
    // Wait for existing load to complete
    while (ffmpegLoading) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (ffmpeg && ffmpegLoaded) {
      return ffmpeg
    }
  }

  ffmpegLoading = true

  try {
    ffmpeg = new FFmpeg()

    // Load FFmpeg with CORS-enabled URLs
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    ffmpegLoaded = true
    console.log('✅ FFmpeg WebAssembly loaded successfully')
    return ffmpeg
  } catch (error) {
    console.error('❌ Failed to load FFmpeg:', error)
    throw new Error('Failed to initialize audio converter')
  } finally {
    ffmpegLoading = false
  }
}

/**
 * Check if a file needs conversion (M4A/MP4 audio containers)
 */
export function needsConversion(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase()
  const mimeType = file.type.toLowerCase()

  // M4A files need conversion for reliable Whisper compatibility
  if (extension === 'm4a') return true
  if (mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a') return true

  // MP4 audio containers
  if (extension === 'mp4' && mimeType.startsWith('audio/')) return true

  return false
}

/**
 * Convert audio file to MP3 format
 */
export async function convertToMp3(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File> {
  if (!needsConversion(file)) {
    console.log(`ℹ️ File ${file.name} does not need conversion`)
    return file
  }

  console.log(`🔄 Converting ${file.name} to MP3...`)
  onProgress?.(5)

  try {
    const ff = await initFFmpeg()
    onProgress?.(15)

    // Generate unique filenames
    const inputName = `input_${Date.now()}.m4a`
    const outputName = `output_${Date.now()}.mp3`

    // Write input file to FFmpeg virtual filesystem
    const inputData = await fetchFile(file)
    await ff.writeFile(inputName, inputData)
    onProgress?.(30)

    // Set up progress tracking
    ff.on('progress', ({ progress }) => {
      // Map FFmpeg progress (0-1) to our progress range (30-90)
      const mappedProgress = 30 + (progress * 60)
      onProgress?.(Math.min(mappedProgress, 90))
    })

    // Convert to MP3 with Whisper-optimized settings
    // - 16kHz sample rate (Whisper's native rate)
    // - Mono channel (speech doesn't need stereo)
    // - 64kbps bitrate (sufficient for speech)
    await ff.exec([
      '-i', inputName,
      '-ar', '16000',      // 16kHz sample rate
      '-ac', '1',          // Mono
      '-b:a', '64k',       // 64kbps bitrate
      '-f', 'mp3',         // MP3 format
      outputName
    ])
    onProgress?.(92)

    // Read the output file
    const outputData = await ff.readFile(outputName)
    onProgress?.(95)

    // Clean up virtual filesystem
    await ff.deleteFile(inputName)
    await ff.deleteFile(outputName)

    // Create new File object with MP3 extension
    const originalBaseName = file.name.replace(/\.[^/.]+$/, '')
    const newFileName = `${originalBaseName}.mp3`

    // Convert FileData to ArrayBuffer for Blob creation
    const mp3Blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: 'audio/mpeg' })
    const mp3File = new File([mp3Blob], newFileName, {
      type: 'audio/mpeg',
      lastModified: Date.now()
    })

    onProgress?.(100)

    console.log(`✅ Conversion complete: ${file.name} (${(file.size / 1024).toFixed(1)}KB) → ${newFileName} (${(mp3File.size / 1024).toFixed(1)}KB)`)

    return mp3File
  } catch (error) {
    console.error('❌ Audio conversion failed:', error)
    throw new Error(`Failed to convert ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Pre-check if FFmpeg can be loaded (for UI feedback)
 */
export async function checkFFmpegSupport(): Promise<boolean> {
  try {
    // Check for required browser features
    if (typeof WebAssembly === 'undefined') {
      console.warn('WebAssembly not supported')
      return false
    }

    if (typeof SharedArrayBuffer === 'undefined') {
      console.warn('SharedArrayBuffer not available - FFmpeg may have reduced performance')
      // Still return true as FFmpeg can work without it (just slower)
    }

    return true
  } catch {
    return false
  }
}
