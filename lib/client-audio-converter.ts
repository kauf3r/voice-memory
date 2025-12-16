/**
 * Client-side audio conversion using Web Audio API + lamejs
 * Converts M4A/MP4 audio files to MP3 for reliable Whisper API compatibility
 * Uses lamejs for MP3 encoding (smaller files than WAV)
 */

// @ts-ignore - lamejs doesn't have types
import lamejs from 'lamejs'

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
 * Convert audio file to MP3 format using Web Audio API + lamejs
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
    // Check for AudioContext support
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) {
      console.warn('⚠️ Web Audio API not supported, using original file')
      return file
    }

    const audioContext = new AudioContextClass()
    onProgress?.(10)

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    onProgress?.(20)

    // Decode audio data
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      onProgress?.(35)
    } catch (decodeError) {
      console.warn('⚠️ Failed to decode audio, using original file:', decodeError)
      await audioContext.close()
      return file
    }

    console.log(`📊 Audio decoded: ${audioBuffer.duration.toFixed(1)}s, ${audioBuffer.numberOfChannels}ch, ${audioBuffer.sampleRate}Hz`)

    // Resample to 16kHz mono for optimal Whisper processing
    const targetSampleRate = 16000
    const offlineContext = new OfflineAudioContext(1, audioBuffer.duration * targetSampleRate, targetSampleRate)

    const source = offlineContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(offlineContext.destination)
    source.start()

    onProgress?.(45)

    const resampledBuffer = await offlineContext.startRendering()
    onProgress?.(55)

    // Clean up audio context
    await audioContext.close()

    // Convert to MP3 using lamejs
    const mp3Data = encodeToMp3(resampledBuffer, onProgress)
    onProgress?.(90)

    // Create new File object with MP3 extension
    const originalBaseName = file.name.replace(/\.[^/.]+$/, '')
    const newFileName = `${originalBaseName}.mp3`

    const mp3Blob = new Blob(mp3Data, { type: 'audio/mpeg' })
    const mp3File = new File([mp3Blob], newFileName, {
      type: 'audio/mpeg',
      lastModified: Date.now()
    })

    onProgress?.(100)

    const sizeReduction = ((file.size - mp3File.size) / file.size * 100).toFixed(1)
    console.log(`✅ Conversion complete: ${file.name} (${(file.size / 1024).toFixed(1)}KB) → ${newFileName} (${(mp3File.size / 1024).toFixed(1)}KB) [${sizeReduction}% smaller]`)

    return mp3File
  } catch (error) {
    console.error('❌ Audio conversion failed:', error)
    console.warn('⚠️ Using original file as fallback')
    return file
  }
}

/**
 * Encode AudioBuffer to MP3 using lamejs
 */
function encodeToMp3(audioBuffer: AudioBuffer, onProgress?: (progress: number) => void): Int8Array[] {
  const channels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const samples = audioBuffer.getChannelData(0)

  // Create MP3 encoder - 64kbps is good for speech
  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, 64)

  const mp3Data: Int8Array[] = []
  const sampleBlockSize = 1152 // Must be multiple of 576 for lamejs

  // Convert Float32Array to Int16Array
  const samples16 = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    samples16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  // Encode in chunks
  const totalBlocks = Math.ceil(samples16.length / sampleBlockSize)
  for (let i = 0; i < samples16.length; i += sampleBlockSize) {
    const chunk = samples16.subarray(i, Math.min(i + sampleBlockSize, samples16.length))
    const mp3buf = mp3encoder.encodeBuffer(chunk)
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf)
    }

    // Update progress (55-90 range)
    if (onProgress && i % (sampleBlockSize * 10) === 0) {
      const blockProgress = (i / sampleBlockSize) / totalBlocks
      onProgress(55 + blockProgress * 35)
    }
  }

  // Flush remaining data
  const mp3buf = mp3encoder.flush()
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf)
  }

  return mp3Data
}

/**
 * Pre-check if audio conversion is supported
 */
export async function checkConversionSupport(): Promise<boolean> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    return !!AudioContextClass
  } catch {
    return false
  }
}
