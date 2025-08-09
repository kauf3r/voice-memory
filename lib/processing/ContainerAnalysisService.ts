/**
 * Container Analysis Service
 * Provides detailed analysis of multimedia container formats for compatibility assessment
 */

export interface ContainerInfo {
  format: string
  brand?: string
  version?: string
  profile?: string
  isCompatible: boolean
  compatibilityScore: number // 0-100
  audioTracks: AudioTrackInfo[]
  videoTracks: VideoTrackInfo[]
  metadata: Record<string, any>
  warnings: string[]
  recommendations: string[]
}

export interface AudioTrackInfo {
  codec: string
  sampleRate?: number
  channels?: number
  bitrate?: number
  duration?: number
  isSupported: boolean
}

export interface VideoTrackInfo {
  codec: string
  width?: number
  height?: number
  frameRate?: number
  duration?: number
}

export class ContainerAnalysisService {
  // Whisper API codec compatibility matrix
  private static readonly WHISPER_COMPATIBLE_CODECS = new Set([
    'aac',    // Advanced Audio Coding
    'mp3',    // MPEG Audio Layer 3
    'pcm',    // Uncompressed PCM
    'flac',   // Free Lossless Audio Codec
    'vorbis', // Ogg Vorbis
    'opus',   // Opus codec
    'wav',    // WAV format
  ])

  // Container format compatibility scores
  private static readonly CONTAINER_SCORES = new Map([
    ['wav', 100],
    ['mp3', 95],
    ['ogg', 90],
    ['webm', 85],
    ['flac', 95],
    ['mp4', 70],  // Depends heavily on codec and brand
    ['m4a', 65],  // Often problematic with Whisper
    ['mov', 60],  // QuickTime format, variable compatibility
    ['avi', 50],  // Old format, codec dependent
    ['mkv', 45],  // Matroska, complex container
  ])

  // Problematic MP4 brands and their compatibility scores
  private static readonly MP4_BRAND_SCORES = new Map([
    ['isom', 75], // ISO Base Media File Format
    ['mp41', 70], // MPEG-4 version 1
    ['mp42', 70], // MPEG-4 version 2
    ['M4A ', 65], // iTunes M4A
    ['M4B ', 60], // iTunes audiobook
    ['M4P ', 50], // iTunes DRM protected
    ['dash', 40], // DASH streaming format
    ['M4VH', 30], // Problematic video format
    ['M4VP', 30], // Problematic video format
    ['MSNV', 25], // Microsoft variant
    ['qt  ', 60], // QuickTime
  ])

  /**
   * Analyze container format and provide compatibility assessment
   */
  async analyzeContainer(buffer: Buffer, mimeType: string, filename: string): Promise<ContainerInfo> {
    const info: ContainerInfo = {
      format: this.detectContainerFormat(buffer, mimeType, filename),
      isCompatible: false,
      compatibilityScore: 0,
      audioTracks: [],
      videoTracks: [],
      metadata: {},
      warnings: [],
      recommendations: []
    }

    // Analyze based on container format
    switch (info.format.toLowerCase()) {
      case 'mp4':
      case 'm4a':
        await this.analyzeMp4Container(buffer, info)
        break
      case 'webm':
        await this.analyzeWebMContainer(buffer, info)
        break
      case 'ogg':
        await this.analyzeOggContainer(buffer, info)
        break
      case 'wav':
        await this.analyzeWavContainer(buffer, info)
        break
      case 'mp3':
        await this.analyzeMp3Container(buffer, info)
        break
      default:
        this.analyzeUnknownContainer(buffer, info)
    }

    // Calculate final compatibility
    this.calculateCompatibility(info)
    this.generateRecommendations(info)

    return info
  }

  /**
   * Analyze MP4/M4A container
   */
  private async analyzeMp4Container(buffer: Buffer, info: ContainerInfo): Promise<void> {
    // Extract brand from ftyp box
    if (buffer.length >= 12 && this.hasMp4Signature(buffer)) {
      const brand = this.extractMp4Brand(buffer)
      if (brand) {
        info.brand = brand
        info.compatibilityScore = ContainerAnalysisService.MP4_BRAND_SCORES.get(brand) || 40
        
        if (ContainerAnalysisService.MP4_BRAND_SCORES.get(brand)! < 50) {
          info.warnings.push(`MP4 brand '${brand}' has known compatibility issues with Whisper`)
        }
      }
    }

    // Analyze audio tracks (simplified - would need full MP4 parser for complete analysis)
    const audioTrack: AudioTrackInfo = {
      codec: this.guessAudioCodecFromMp4Brand(info.brand || ''),
      isSupported: false
    }

    if (audioTrack.codec) {
      audioTrack.isSupported = ContainerAnalysisService.WHISPER_COMPATIBLE_CODECS.has(audioTrack.codec.toLowerCase())
    }

    info.audioTracks.push(audioTrack)

    // Add specific MP4/M4A warnings
    if (info.format === 'm4a') {
      info.warnings.push('M4A files often have container compatibility issues')
      info.warnings.push('Consider converting to WAV or MP3 for better reliability')
    }
  }

  /**
   * Analyze WebM container
   */
  private async analyzeWebMContainer(buffer: Buffer, info: ContainerInfo): Promise<void> {
    info.compatibilityScore = ContainerAnalysisService.CONTAINER_SCORES.get('webm') || 85

    // WebM typically uses Vorbis or Opus for audio
    const audioTrack: AudioTrackInfo = {
      codec: 'vorbis', // Most common in WebM
      isSupported: true
    }
    info.audioTracks.push(audioTrack)

    info.warnings.push('WebM format is generally well supported by Whisper')
  }

  /**
   * Analyze OGG container
   */
  private async analyzeOggContainer(buffer: Buffer, info: ContainerInfo): Promise<void> {
    info.compatibilityScore = ContainerAnalysisService.CONTAINER_SCORES.get('ogg') || 90

    const audioTrack: AudioTrackInfo = {
      codec: 'vorbis',
      isSupported: true
    }
    info.audioTracks.push(audioTrack)
  }

  /**
   * Analyze WAV container
   */
  private async analyzeWavContainer(buffer: Buffer, info: ContainerInfo): Promise<void> {
    info.compatibilityScore = ContainerAnalysisService.CONTAINER_SCORES.get('wav') || 100
    info.isCompatible = true

    const audioTrack: AudioTrackInfo = {
      codec: 'pcm',
      isSupported: true
    }

    // Extract basic WAV info
    if (buffer.length >= 44) {
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      audioTrack.channels = view.getUint16(22, true)
      audioTrack.sampleRate = view.getUint32(24, true)
      audioTrack.bitrate = view.getUint32(28, true) * 8
    }

    info.audioTracks.push(audioTrack)
  }

  /**
   * Analyze MP3 container
   */
  private async analyzeMp3Container(buffer: Buffer, info: ContainerInfo): Promise<void> {
    info.compatibilityScore = ContainerAnalysisService.CONTAINER_SCORES.get('mp3') || 95
    info.isCompatible = true

    const audioTrack: AudioTrackInfo = {
      codec: 'mp3',
      isSupported: true
    }
    info.audioTracks.push(audioTrack)
  }

  /**
   * Analyze unknown container
   */
  private analyzeUnknownContainer(buffer: Buffer, info: ContainerInfo): void {
    info.compatibilityScore = 30
    info.warnings.push('Unknown container format detected')
    info.warnings.push('Compatibility with Whisper API uncertain')

    // Try to detect magic bytes for additional info
    const magicBytes = buffer.slice(0, 16)
    const hexString = Array.from(magicBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
    info.metadata.magicBytes = hexString
  }

  /**
   * Calculate final compatibility assessment
   */
  private calculateCompatibility(info: ContainerInfo): void {
    // Base score from container format
    let score = info.compatibilityScore

    // Adjust based on audio track compatibility
    if (info.audioTracks.length > 0) {
      const supportedTracks = info.audioTracks.filter(track => track.isSupported).length
      const trackRatio = supportedTracks / info.audioTracks.length
      score *= trackRatio
    }

    // Final threshold for compatibility
    info.isCompatible = score >= 70
    info.compatibilityScore = Math.round(score)
  }

  /**
   * Generate format-specific recommendations
   */
  private generateRecommendations(info: ContainerInfo): void {
    if (info.compatibilityScore >= 90) {
      info.recommendations.push('Format is highly compatible with Whisper API')
    } else if (info.compatibilityScore >= 70) {
      info.recommendations.push('Format should work with Whisper API')
    } else if (info.compatibilityScore >= 50) {
      info.recommendations.push('Consider converting to WAV or MP3 for better reliability')
      info.recommendations.push('Current format may work but could fail intermittently')
    } else {
      info.recommendations.push('Strong recommendation: Convert to WAV, MP3, or OGG format')
      info.recommendations.push('Current format likely to fail with Whisper API')
    }

    // Format-specific recommendations
    if (info.format === 'm4a' || info.format === 'mp4') {
      info.recommendations.push('For M4A/MP4: WAV conversion will provide best compatibility')
    }
    
    if (info.audioTracks.some(track => !track.isSupported)) {
      info.recommendations.push('Audio codec conversion may be required')
    }
  }

  /**
   * Detect container format from buffer and metadata
   */
  private detectContainerFormat(buffer: Buffer, mimeType: string, filename: string): string {
    // Check magic bytes first (most reliable)
    if (this.hasMp4Signature(buffer)) {
      // Distinguish between MP4 and M4A based on MIME type or extension
      const ext = filename.split('.').pop()?.toLowerCase()
      if (ext === 'm4a' || mimeType.includes('audio')) {
        return 'm4a'
      }
      return 'mp4'
    }

    if (this.hasWebMSignature(buffer)) return 'webm'
    if (this.hasOggSignature(buffer)) return 'ogg'
    if (this.hasWavSignature(buffer)) return 'wav'
    if (this.hasMp3Signature(buffer)) return 'mp3'

    // Fallback to MIME type
    if (mimeType.includes('mp4')) return 'mp4'
    if (mimeType.includes('webm')) return 'webm'
    if (mimeType.includes('ogg')) return 'ogg'
    if (mimeType.includes('wav')) return 'wav'
    if (mimeType.includes('mpeg')) return 'mp3'

    // Last resort: file extension
    const ext = filename.split('.').pop()?.toLowerCase()
    return ext || 'unknown'
  }

  // Magic byte detection methods
  private hasMp4Signature(buffer: Buffer): boolean {
    return buffer.length >= 8 && 
           buffer[4] === 0x66 && buffer[5] === 0x74 && 
           buffer[6] === 0x79 && buffer[7] === 0x70
  }

  private hasWebMSignature(buffer: Buffer): boolean {
    return buffer.length >= 4 &&
           buffer[0] === 0x1A && buffer[1] === 0x45 &&
           buffer[2] === 0xDF && buffer[3] === 0xA3
  }

  private hasOggSignature(buffer: Buffer): boolean {
    return buffer.length >= 4 &&
           buffer[0] === 0x4F && buffer[1] === 0x67 &&
           buffer[2] === 0x67 && buffer[3] === 0x53
  }

  private hasWavSignature(buffer: Buffer): boolean {
    return buffer.length >= 12 &&
           buffer.toString('ascii', 0, 4) === 'RIFF' &&
           buffer.toString('ascii', 8, 12) === 'WAVE'
  }

  private hasMp3Signature(buffer: Buffer): boolean {
    return buffer.length >= 2 &&
           ((buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) || // MPEG sync
            buffer.toString('ascii', 0, 3) === 'ID3') // ID3 tag
  }

  private extractMp4Brand(buffer: Buffer): string | undefined {
    if (!this.hasMp4Signature(buffer) || buffer.length < 12) return undefined
    return buffer.toString('ascii', 8, 12)
  }

  private guessAudioCodecFromMp4Brand(brand: string): string {
    switch (brand) {
      case 'M4A ': return 'aac'
      case 'M4B ': return 'aac'
      case 'mp41': return 'aac'
      case 'mp42': return 'aac'
      case 'isom': return 'aac'
      default: return 'unknown'
    }
  }

  /**
   * Quick compatibility check without full analysis
   */
  static quickCompatibilityCheck(mimeType: string, filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase()
    const score = ContainerAnalysisService.CONTAINER_SCORES.get(ext || '') || 0
    return score >= 70
  }
}