/**
 * Audio Format Normalization Service
 * Handles format conversion and container analysis for maximum Whisper API compatibility
 * Addresses M4A/MP4 container format compatibility issues
 */

export interface AudioFormatAnalysis {
  isCompatible: boolean
  detectedFormat: string
  containerType: string
  brand?: string
  needsConversion: boolean
  recommendedFormat: string
  issues: string[]
}

export interface NormalizationResult {
  success: boolean
  buffer: Buffer
  mimeType: string
  originalFormat: string
  normalizedFormat: string
  warnings: string[]
  error?: string
}

export class AudioFormatNormalizationService {
  // Whisper API supported formats (ordered by preference)
  private static readonly WHISPER_SUPPORTED_FORMATS = [
    'audio/wav',
    'audio/mpeg', // MP3
    'audio/ogg',
    'audio/webm',
    'audio/flac',
    'audio/x-flac'
  ]

  // Problematic M4A/MP4 container brands that often fail
  private static readonly PROBLEMATIC_BRANDS = new Set([
    'M4VH', 'M4VP', 'MSNV', 'NDAS', 'NDSC', 'NDSH', 'NDSM', 'NDSP', 'NDSS', 'NDXC', 'NDXH', 'NDXM', 'NDXP', 'NDXS'
  ])

  /**
   * Analyze audio format for Whisper compatibility
   */
  async analyzeFormat(buffer: Buffer, mimeType: string): Promise<AudioFormatAnalysis> {
    const analysis: AudioFormatAnalysis = {
      isCompatible: false,
      detectedFormat: mimeType,
      containerType: 'unknown',
      needsConversion: false,
      recommendedFormat: 'audio/wav',
      issues: []
    }

    // Check if format is already Whisper-compatible
    if (AudioFormatNormalizationService.WHISPER_SUPPORTED_FORMATS.includes(mimeType)) {
      analysis.isCompatible = true
      analysis.recommendedFormat = mimeType
      return analysis
    }

    // Analyze magic bytes
    const magicBytes = buffer.slice(0, 32)
    const header = Array.from(new Uint8Array(magicBytes.slice(0, 12)))
      .map(b => b.toString(16).padStart(2, '0')).join(' ')

    // MP4/M4A container analysis
    if (this.isMp4Container(magicBytes)) {
      analysis.containerType = 'mp4'
      analysis.brand = this.extractMp4Brand(magicBytes)
      
      if (analysis.brand && AudioFormatNormalizationService.PROBLEMATIC_BRANDS.has(analysis.brand)) {
        analysis.issues.push(`Problematic MP4 brand: ${analysis.brand}`)
        analysis.needsConversion = true
        analysis.recommendedFormat = 'audio/wav'
      } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
        // Even compatible brands may have issues - safer to convert
        analysis.issues.push('M4A/MP4 container may have compatibility issues with Whisper')
        analysis.needsConversion = true
        analysis.recommendedFormat = 'audio/wav'
      }
    }
    // WebM container analysis
    else if (this.isWebMContainer(magicBytes)) {
      analysis.containerType = 'webm'
      analysis.isCompatible = true
      analysis.recommendedFormat = 'audio/webm'
    }
    // Other container types
    else {
      analysis.issues.push(`Unknown container format detected (header: ${header})`)
      analysis.needsConversion = true
      analysis.recommendedFormat = 'audio/wav'
    }

    return analysis
  }

  /**
   * Normalize audio format for maximum Whisper compatibility
   */
  async normalizeFormat(
    buffer: Buffer, 
    mimeType: string, 
    filename: string
  ): Promise<NormalizationResult> {
    const result: NormalizationResult = {
      success: false,
      buffer,
      mimeType,
      originalFormat: mimeType,
      normalizedFormat: mimeType,
      warnings: []
    }

    try {
      // First, analyze the format
      const analysis = await this.analyzeFormat(buffer, mimeType)
      
      if (analysis.isCompatible && !analysis.needsConversion) {
        result.success = true
        result.warnings.push('No conversion needed - format is already compatible')
        return result
      }

      // Log conversion attempt
      console.log(`🔄 Audio normalization needed for ${filename}:`)
      console.log(`  Original format: ${mimeType}`)
      console.log(`  Container type: ${analysis.containerType}`)
      console.log(`  Issues: ${analysis.issues.join(', ')}`)
      console.log(`  Recommended format: ${analysis.recommendedFormat}`)

      // Attempt format conversion using Web Audio API (if available) or fallback
      const conversionResult = await this.convertToCompatibleFormat(
        buffer, 
        mimeType, 
        analysis.recommendedFormat
      )

      if (conversionResult.success) {
        result.success = true
        result.buffer = conversionResult.buffer
        result.mimeType = conversionResult.mimeType
        result.normalizedFormat = conversionResult.mimeType
        result.warnings = conversionResult.warnings
        
        console.log(`✅ Audio successfully normalized:`)
        console.log(`  ${result.originalFormat} → ${result.normalizedFormat}`)
        console.log(`  Size change: ${buffer.length} → ${result.buffer.length} bytes`)
      } else {
        // Conversion failed, but we can still try with original format
        result.success = true // Allow processing to continue
        result.error = conversionResult.error
        result.warnings.push('Format conversion failed, attempting with original format')
        result.warnings.push(`Conversion error: ${conversionResult.error}`)
        
        console.warn(`⚠️ Audio conversion failed for ${filename}:`)
        console.warn(`  Error: ${conversionResult.error}`)
        console.warn(`  Proceeding with original format (may fail in Whisper)`)
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      result.warnings.push('Normalization process failed, using original format')
      result.success = true // Allow processing to continue
      
      console.error(`❌ Audio normalization error for ${filename}:`, error)
    }

    return result
  }

  /**
   * Convert audio to compatible format
   */
  private async convertToCompatibleFormat(
    buffer: Buffer, 
    originalMimeType: string, 
    targetMimeType: string
  ): Promise<{ success: boolean; buffer: Buffer; mimeType: string; warnings: string[]; error?: string }> {
    const warnings: string[] = []

    try {
      // For M4A/MP4 files, try server-side FFmpeg conversion first
      if ((originalMimeType.includes('mp4') || originalMimeType.includes('m4a')) && 
          targetMimeType === 'audio/wav') {
        
        // Try server-side FFmpeg conversion
        if (typeof window === 'undefined') {
          const ffmpegResult = await this.convertToWavUsingFFmpeg(buffer, warnings)
          if (ffmpegResult.success) {
            return ffmpegResult
          }
          warnings.push('FFmpeg conversion failed, trying Web Audio fallback')
        }
        
        // Fallback to Web Audio API if in browser
        if (typeof AudioContext !== 'undefined') {
          return await this.convertToWavUsingWebAudio(buffer, warnings)
        }
      }

      // For other formats, return original with warning
      warnings.push(`Direct conversion from ${originalMimeType} to ${targetMimeType} not implemented`)
      warnings.push('Using original format - transcription may fail')
      
      return {
        success: false,
        buffer,
        mimeType: originalMimeType,
        warnings,
        error: `No conversion method available for ${originalMimeType} → ${targetMimeType}`
      }

    } catch (error) {
      return {
        success: false,
        buffer,
        mimeType: originalMimeType,
        warnings,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Convert audio to WAV using Web Audio API (client-side only)
   */
  private async convertToWavUsingWebAudio(
    buffer: Buffer, 
    warnings: string[]
  ): Promise<{ success: boolean; buffer: Buffer; mimeType: string; warnings: string[]; error?: string }> {
    try {
      // This only works in browser environment
      if (typeof AudioContext === 'undefined') {
        throw new Error('Web Audio API not available (server-side)')
      }

      const audioContext = new AudioContext()
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      
      // Convert to WAV format
      const wavBuffer = this.audioBufferToWav(audioBuffer)
      
      await audioContext.close()
      
      warnings.push('Successfully converted to WAV using Web Audio API')
      
      return {
        success: true,
        buffer: Buffer.from(wavBuffer),
        mimeType: 'audio/wav',
        warnings
      }

    } catch (error) {
      return {
        success: false,
        buffer,
        mimeType: 'application/octet-stream',
        warnings,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Convert AudioBuffer to WAV format
   */
  private audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const length = audioBuffer.length
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const bytesPerSample = 2 // 16-bit
    
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * bytesPerSample)
    const view = new DataView(buffer)
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length * numberOfChannels * bytesPerSample, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // PCM
    view.setUint16(20, 1, true) // format
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true)
    view.setUint16(32, numberOfChannels * bytesPerSample, true)
    view.setUint16(34, 8 * bytesPerSample, true)
    writeString(36, 'data')
    view.setUint32(40, length * numberOfChannels * bytesPerSample, true)
    
    // Audio data
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample * 0x7FFF, true)
        offset += 2
      }
    }
    
    return buffer
  }

  /**
   * Convert audio to WAV using FFmpeg (server-side only)
   */
  private async convertToWavUsingFFmpeg(
    buffer: Buffer,
    warnings: string[]
  ): Promise<{ success: boolean; buffer: Buffer; mimeType: string; warnings: string[]; error?: string }> {
    try {
      // Only available on server-side
      if (typeof window !== 'undefined') {
        throw new Error('FFmpeg conversion only available on server-side')
      }

      const ffmpeg = require('fluent-ffmpeg')
      const ffmpegPath = require('ffmpeg-static')
      const fs = require('fs')
      const path = require('path')
      const os = require('os')

      // Configure FFmpeg to use the static binary
      ffmpeg.setFfmpegPath(ffmpegPath)

      // Create temporary files
      const tempDir = os.tmpdir()
      const inputFile = path.join(tempDir, `input_${Date.now()}.m4a`)

      // Write input buffer to temp file
      fs.writeFileSync(inputFile, buffer)

      // Estimate WAV size (16kHz mono 16-bit = 32KB/sec)
      // If original file > 800KB, MP3 is safer to stay under 25MB limit
      const useMP3 = buffer.length > 800 * 1024
      const outputFormat = useMP3 ? 'mp3' : 'wav'
      const outputFile = path.join(tempDir, `output_${Date.now()}.${outputFormat}`)

      // Convert using FFmpeg
      await new Promise<void>((resolve, reject) => {
        const cmd = ffmpeg(inputFile)
          .audioChannels(1) // Mono for better Whisper compatibility
          .audioFrequency(16000) // 16kHz sample rate (Whisper optimal)

        if (useMP3) {
          cmd.toFormat('mp3')
            .audioCodec('libmp3lame')
            .audioBitrate('64k') // Low bitrate for speech, keeps file small
        } else {
          cmd.toFormat('wav')
            .audioCodec('pcm_s16le') // 16-bit PCM
        }

        cmd.on('end', () => resolve())
          .on('error', (error: Error) => reject(error))
          .save(outputFile)
      })

      // Read converted file
      const convertedBuffer = fs.readFileSync(outputFile)

      // Cleanup temp files
      try {
        fs.unlinkSync(inputFile)
        fs.unlinkSync(outputFile)
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp files:', cleanupError)
      }

      const outputMimeType = useMP3 ? 'audio/mpeg' : 'audio/wav'
      warnings.push(`Successfully converted M4A to ${outputFormat.toUpperCase()} using FFmpeg`)
      warnings.push(`Optimized for Whisper: 16kHz mono${useMP3 ? ' 64kbps' : ' PCM'}`)

      return {
        success: true,
        buffer: convertedBuffer,
        mimeType: outputMimeType,
        warnings
      }

    } catch (error) {
      return {
        success: false,
        buffer,
        mimeType: 'application/octet-stream',
        warnings,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Compress large audio files for faster upload to Whisper API
   * This is especially important for serverless environments with network constraints
   */
  async compressForWhisperUpload(
    buffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<{ success: boolean; buffer: Buffer; mimeType: string; originalSize: number; compressedSize: number; warnings: string[] }> {
    const warnings: string[] = []
    const originalSize = buffer.length

    // Only compress files larger than 2MB - smaller files should upload fine
    const COMPRESSION_THRESHOLD = 2 * 1024 * 1024

    if (buffer.length < COMPRESSION_THRESHOLD) {
      console.log(`📦 Audio file ${(buffer.length / 1024 / 1024).toFixed(2)}MB - no compression needed`)
      return {
        success: true,
        buffer,
        mimeType,
        originalSize,
        compressedSize: buffer.length,
        warnings: ['File size under threshold, no compression applied']
      }
    }

    console.log(`📦 Compressing large audio file: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`)

    try {
      // Only available on server-side
      if (typeof window !== 'undefined') {
        warnings.push('Audio compression only available on server-side')
        return { success: false, buffer, mimeType, originalSize, compressedSize: buffer.length, warnings }
      }

      const ffmpeg = require('fluent-ffmpeg')
      const ffmpegPath = require('ffmpeg-static')
      const fs = require('fs')
      const path = require('path')
      const os = require('os')

      // Configure FFmpeg to use the static binary
      ffmpeg.setFfmpegPath(ffmpegPath)

      // Determine input extension from mime type
      const inputExt = mimeType.includes('mpeg') ? 'mp3' :
                       mimeType.includes('wav') ? 'wav' :
                       mimeType.includes('ogg') ? 'ogg' :
                       mimeType.includes('webm') ? 'webm' :
                       mimeType.includes('m4a') ? 'm4a' :
                       mimeType.includes('mp4') ? 'm4a' : 'mp3'

      // Create temporary files
      const tempDir = os.tmpdir()
      const inputFile = path.join(tempDir, `compress_in_${Date.now()}.${inputExt}`)
      const outputFile = path.join(tempDir, `compress_out_${Date.now()}.mp3`)

      // Write input buffer to temp file
      fs.writeFileSync(inputFile, buffer)

      // Compress using FFmpeg - aggressive settings for speech
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputFile)
          .audioChannels(1) // Mono - halves file size
          .audioFrequency(16000) // 16kHz - optimal for Whisper, reduces size
          .toFormat('mp3')
          .audioCodec('libmp3lame')
          .audioBitrate('32k') // Very low bitrate - sufficient for speech, ~240KB/min
          .on('start', (cmd: string) => console.log(`📦 FFmpeg: ${cmd}`))
          .on('end', () => resolve())
          .on('error', (error: Error) => reject(error))
          .save(outputFile)
      })

      // Read compressed file
      const compressedBuffer = fs.readFileSync(outputFile)
      const compressedSize = compressedBuffer.length

      // Cleanup temp files
      try {
        fs.unlinkSync(inputFile)
        fs.unlinkSync(outputFile)
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp files:', cleanupError)
      }

      const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1)
      console.log(`✅ Compression complete: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% reduction)`)

      warnings.push(`Compressed from ${(originalSize / 1024 / 1024).toFixed(2)}MB to ${(compressedSize / 1024 / 1024).toFixed(2)}MB`)
      warnings.push('Optimized for Whisper: 16kHz mono 32kbps MP3')

      return {
        success: true,
        buffer: compressedBuffer,
        mimeType: 'audio/mpeg',
        originalSize,
        compressedSize,
        warnings
      }

    } catch (error) {
      console.error('❌ Audio compression failed:', error)
      warnings.push(`Compression failed: ${error instanceof Error ? error.message : String(error)}`)
      return {
        success: false,
        buffer,
        mimeType,
        originalSize,
        compressedSize: buffer.length,
        warnings
      }
    }
  }

  /**
   * Check if buffer contains MP4 container
   */
  private isMp4Container(buffer: Buffer): boolean {
    if (buffer.length < 8) return false
    
    // Check for ftyp box
    return buffer[4] === 0x66 && 
           buffer[5] === 0x74 && 
           buffer[6] === 0x79 && 
           buffer[7] === 0x70
  }

  /**
   * Extract MP4 brand from ftyp box
   */
  private extractMp4Brand(buffer: Buffer): string | undefined {
    if (!this.isMp4Container(buffer) || buffer.length < 12) return undefined
    
    // Extract brand (4 bytes starting at offset 8)
    const brandBytes = buffer.slice(8, 12)
    return String.fromCharCode(...Array.from(brandBytes))
  }

  /**
   * Check if buffer contains WebM container
   */
  private isWebMContainer(buffer: Buffer): boolean {
    if (buffer.length < 4) return false
    
    // Check for EBML signature
    return buffer[0] === 0x1A && 
           buffer[1] === 0x45 && 
           buffer[2] === 0xDF && 
           buffer[3] === 0xA3
  }

  /**
   * Get file size limits for different formats
   */
  static getFileSizeLimit(mimeType: string): number {
    // Whisper API has a 25MB limit
    const WHISPER_LIMIT = 25 * 1024 * 1024
    
    // Some formats compress better than others
    switch (mimeType) {
      case 'audio/wav':
        return WHISPER_LIMIT * 0.8 // WAV is uncompressed, be conservative
      case 'audio/mpeg':
        return WHISPER_LIMIT * 0.95 // MP3 is well compressed
      case 'audio/ogg':
      case 'audio/webm':
        return WHISPER_LIMIT * 0.9 // Good compression
      default:
        return WHISPER_LIMIT * 0.85 // Conservative for unknown formats
    }
  }

  /**
   * Quick compatibility check without full analysis
   */
  static isFormatCompatible(mimeType: string): boolean {
    return AudioFormatNormalizationService.WHISPER_SUPPORTED_FORMATS.includes(mimeType)
  }
}