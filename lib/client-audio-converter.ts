/**
 * Client-side audio conversion using Web Audio API
 * Converts M4A/MP4 audio files to WAV for reliable Whisper API compatibility
 * No external dependencies - uses native browser APIs
 */

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
 * Convert audio file to WAV format using Web Audio API
 */
export async function convertToMp3(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File> {
  if (!needsConversion(file)) {
    console.log(`ℹ️ File ${file.name} does not need conversion`)
    return file
  }

  console.log(`🔄 Converting ${file.name} to WAV using Web Audio API...`)
  onProgress?.(10)

  try {
    // Check for AudioContext support
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) {
      console.warn('⚠️ Web Audio API not supported, using original file')
      return file
    }

    const audioContext = new AudioContextClass()
    onProgress?.(20)

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    onProgress?.(30)

    // Decode audio data
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      onProgress?.(50)
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

    onProgress?.(60)

    const resampledBuffer = await offlineContext.startRendering()
    onProgress?.(70)

    // Convert to WAV
    const wavBuffer = audioBufferToWav(resampledBuffer)
    onProgress?.(85)

    // Clean up
    await audioContext.close()

    // Create new File object with WAV extension
    const originalBaseName = file.name.replace(/\.[^/.]+$/, '')
    const newFileName = `${originalBaseName}.wav`

    const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' })
    const wavFile = new File([wavBlob], newFileName, {
      type: 'audio/wav',
      lastModified: Date.now()
    })

    onProgress?.(100)

    const compressionRatio = ((file.size - wavFile.size) / file.size * 100).toFixed(1)
    console.log(`✅ Conversion complete: ${file.name} (${(file.size / 1024).toFixed(1)}KB) → ${newFileName} (${(wavFile.size / 1024).toFixed(1)}KB) [${compressionRatio}% ${wavFile.size < file.size ? 'smaller' : 'larger'}]`)

    return wavFile
  } catch (error) {
    console.error('❌ Audio conversion failed:', error)
    console.warn('⚠️ Using original file as fallback')
    return file // Fall back to original file instead of throwing
  }
}

/**
 * Convert AudioBuffer to WAV format
 */
function audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length
  const bytesPerSample = 2 // 16-bit
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = length * blockAlign
  const bufferSize = 44 + dataSize

  const buffer = new ArrayBuffer(bufferSize)
  const view = new DataView(buffer)

  // WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // audio format (PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 8 * bytesPerSample, true) // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // Audio data - interleave channels
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
      view.setInt16(offset, sample * 0x7FFF, true)
      offset += 2
    }
  }

  return buffer
}

/**
 * Helper to write string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
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
