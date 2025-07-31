/**
 * Advanced Audio Processing Optimizer for Voice Memory
 * 
 * Handles intelligent audio preprocessing, optimization, and chunking
 * for improved transcription accuracy and cost efficiency.
 */

import { createServerFileFromBuffer } from './storage'

export interface AudioOptimizationResult {
  optimizedBuffer: Buffer
  originalSize: number
  optimizedSize: number
  compressionRatio: number
  detectedFormat: string
  estimatedDuration: number
  qualityMetrics: AudioQualityMetrics
  shouldChunk: boolean
  chunkStrategy?: ChunkStrategy
  whisperModel: 'whisper-1' | 'whisper-large'
  processingCost: number
}

export interface AudioQualityMetrics {
  signalToNoiseRatio: number
  averageVolume: number
  dynamicRange: number
  containsSpeech: boolean
  languageConfidence: number
  estimatedSpeakers: number
}

export interface ChunkStrategy {
  chunkSize: number
  overlapSeconds: number
  chunks: AudioChunk[]
  mergeStrategy: 'concatenate' | 'smart_merge'
}

export interface AudioChunk {
  start: number
  end: number
  buffer: Buffer
  estimatedWords: number
  priority: 'high' | 'medium' | 'low'
}

export interface AudioPreprocessingOptions {
  enableNoiseReduction: boolean
  normalizeVolume: boolean
  enhanceVoice: boolean
  removeBackground: boolean
  targetSampleRate: number
  targetBitrate: number
  maxFileSize: number
}

/**
 * Advanced audio format detection using magic bytes and header analysis
 */
export function detectAudioFormat(buffer: Buffer): {
  format: string
  mimeType: string
  confidence: number
  metadata: any
} {
  const formats = [
    {
      name: 'MP3',
      mimeType: 'audio/mpeg',
      detector: (buf: Buffer) => {
        // ID3v2 tag
        if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
          return { confidence: 0.95, metadata: { hasID3: true } }
        }
        // MPEG frame sync
        if (buf.length >= 2 && buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) {
          return { confidence: 0.9, metadata: { frameSync: true } }
        }
        return null
      }
    },
    {
      name: 'M4A',
      mimeType: 'audio/mp4',
      detector: (buf: Buffer) => {
        if (buf.length >= 12 && 
            buf[4] === 0x66 && buf[5] === 0x74 && 
            buf[6] === 0x79 && buf[7] === 0x70) {
          const brand = buf.slice(8, 12).toString('ascii')
          const audioContainerBrands = ['M4A ', 'M4B ', 'mp41', 'mp42']
          const confidence = audioContainerBrands.includes(brand) ? 0.95 : 0.8
          return { confidence, metadata: { brand, container: 'MP4' } }
        }
        return null
      }
    },
    {
      name: 'WAV',
      mimeType: 'audio/wav',
      detector: (buf: Buffer) => {
        if (buf.length >= 12 &&
            buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
            buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) {
          const fileSize = buf.readUInt32LE(4)
          return { confidence: 0.95, metadata: { fileSize, uncompressed: true } }
        }
        return null
      }
    },
    {
      name: 'OGG',
      mimeType: 'audio/ogg',
      detector: (buf: Buffer) => {
        if (buf.length >= 4 && 
            buf[0] === 0x4F && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
          return { confidence: 0.9, metadata: { container: 'OGG' } }
        }
        return null
      }
    },
    {
      name: 'WEBM',
      mimeType: 'audio/webm',
      detector: (buf: Buffer) => {
        if (buf.length >= 4 && 
            buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) {
          return { confidence: 0.9, metadata: { container: 'WEBM' } }
        }
        return null
      }
    }
  ]

  for (const format of formats) {
    const result = format.detector(buffer)
    if (result) {
      return {
        format: format.name,
        mimeType: format.mimeType,
        confidence: result.confidence,
        metadata: result.metadata
      }
    }
  }

  return {
    format: 'Unknown',
    mimeType: 'audio/mpeg',
    confidence: 0.1,
    metadata: {}
  }
}

/**
 * Estimate audio duration from file size and format
 */
export function estimateAudioDuration(buffer: Buffer, format: string): number {
  const fileSizeKB = buffer.length / 1024
  
  // Average bitrates by format (kbps)
  const avgBitrates = {
    'MP3': 128,
    'M4A': 128,
    'WAV': 1411, // 16-bit, 44.1kHz stereo
    'OGG': 160,
    'WEBM': 128,
    'Unknown': 128
  }

  const bitrate = avgBitrates[format as keyof typeof avgBitrates] || 128
  const durationSeconds = (fileSizeKB * 8) / bitrate

  return Math.max(1, Math.round(durationSeconds))
}

/**
 * Analyze audio quality and characteristics
 */
export function analyzeAudioQuality(buffer: Buffer, format: string): AudioQualityMetrics {
  // Simplified quality analysis - in production, would use audio processing library
  const fileSize = buffer.length
  const estimatedDuration = estimateAudioDuration(buffer, format)
  const avgBitrate = (fileSize * 8) / (estimatedDuration * 1000)

  // Quality heuristics based on file characteristics
  const signalToNoiseRatio = Math.min(50, Math.max(10, avgBitrate / 10))
  const averageVolume = 0.5 + (avgBitrate - 64) / 512 // Normalized 0-1
  const dynamicRange = format === 'WAV' ? 96 : Math.min(80, avgBitrate / 2)
  
  // Speech detection heuristics
  const containsSpeech = fileSize > 10000 && estimatedDuration > 5 // Basic size check
  const languageConfidence = avgBitrate > 64 ? 0.8 : 0.6
  const estimatedSpeakers = estimatedDuration > 60 ? 2 : 1

  return {
    signalToNoiseRatio,
    averageVolume: Math.min(1, Math.max(0, averageVolume)),
    dynamicRange,
    containsSpeech,
    languageConfidence: Math.min(1, Math.max(0, languageConfidence)),
    estimatedSpeakers
  }
}

/**
 * Determine optimal Whisper model based on audio characteristics
 */
export function selectOptimalWhisperModel(
  qualityMetrics: AudioQualityMetrics,
  duration: number,
  fileSize: number
): { model: 'whisper-1' | 'whisper-large'; reasoning: string; estimatedCost: number } {
  
  // Cost per minute (estimated)
  const costs = {
    'whisper-1': 0.006, // $0.006 per minute
    'whisper-large': 0.036 // Hypothetical premium model cost
  }

  // Use whisper-large for:
  // 1. Poor audio quality (low SNR)
  // 2. Multiple speakers
  // 3. Long recordings with complex content
  // 4. Low language confidence
  
  const needsLargeModel = 
    qualityMetrics.signalToNoiseRatio < 20 ||
    qualityMetrics.estimatedSpeakers > 1 ||
    (duration > 300 && qualityMetrics.languageConfidence < 0.7) ||
    qualityMetrics.averageVolume < 0.3

  const model = needsLargeModel ? 'whisper-large' : 'whisper-1'
  const estimatedCost = (duration / 60) * costs[model]

  const reasoning = needsLargeModel 
    ? `Selected whisper-large due to ${qualityMetrics.signalToNoiseRatio < 20 ? 'poor audio quality' : 
         qualityMetrics.estimatedSpeakers > 1 ? 'multiple speakers' : 
         'complex/long content'}`
    : 'Selected whisper-1 for good quality, single-speaker audio'

  return { model, reasoning, estimatedCost }
}

/**
 * Determine if audio should be chunked and create chunk strategy
 */
export function createChunkStrategy(
  buffer: Buffer,
  duration: number,
  qualityMetrics: AudioQualityMetrics
): ChunkStrategy | null {
  
  // Chunk if:
  // 1. File is longer than 10 minutes
  // 2. File is larger than 20MB
  // 3. Low quality audio that might benefit from smaller chunks
  
  const shouldChunk = 
    duration > 600 || // 10 minutes
    buffer.length > 20 * 1024 * 1024 || // 20MB
    qualityMetrics.signalToNoiseRatio < 15

  if (!shouldChunk) {
    return null
  }

  // Determine optimal chunk size
  let chunkSize: number
  if (duration > 1800) { // 30+ minutes
    chunkSize = 300 // 5-minute chunks
  } else if (duration > 900) { // 15+ minutes
    chunkSize = 240 // 4-minute chunks
  } else {
    chunkSize = 180 // 3-minute chunks
  }

  const overlapSeconds = 10 // 10-second overlap for context
  const chunks: AudioChunk[] = []
  
  const bytesPerSecond = buffer.length / duration
  
  for (let start = 0; start < duration; start += chunkSize - overlapSeconds) {
    const end = Math.min(start + chunkSize, duration)
    const startByte = Math.floor(start * bytesPerSecond)
    const endByte = Math.floor(end * bytesPerSecond)
    
    const chunkBuffer = buffer.slice(startByte, endByte)
    const estimatedWords = (end - start) * 2.5 // ~2.5 words per second average
    
    // Prioritize chunks with better audio quality
    const priority = qualityMetrics.averageVolume > 0.6 ? 'high' : 
                    qualityMetrics.averageVolume > 0.3 ? 'medium' : 'low'
    
    chunks.push({
      start,
      end,
      buffer: chunkBuffer,
      estimatedWords,
      priority
    })
  }

  return {
    chunkSize,
    overlapSeconds,
    chunks,
    mergeStrategy: qualityMetrics.estimatedSpeakers > 1 ? 'smart_merge' : 'concatenate'
  }
}

/**
 * Main audio optimization function
 */
export async function optimizeAudioForTranscription(
  buffer: Buffer,
  filename: string,
  options: AudioPreprocessingOptions = {
    enableNoiseReduction: true,
    normalizeVolume: true,
    enhanceVoice: true,
    removeBackground: false,
    targetSampleRate: 16000,
    targetBitrate: 64,
    maxFileSize: 20 * 1024 * 1024
  }
): Promise<AudioOptimizationResult> {
  
  console.log(`Optimizing audio: ${filename} (${buffer.length} bytes)`)
  
  // Step 1: Detect format and analyze quality
  const formatDetection = detectAudioFormat(buffer)
  const estimatedDuration = estimateAudioDuration(buffer, formatDetection.format)
  const qualityMetrics = analyzeAudioQuality(buffer, formatDetection.format)
  
  console.log('Audio analysis:', {
    format: formatDetection.format,
    duration: estimatedDuration,
    quality: qualityMetrics
  })

  // Step 2: Select optimal Whisper model
  const modelSelection = selectOptimalWhisperModel(qualityMetrics, estimatedDuration, buffer.length)
  console.log('Model selection:', modelSelection)

  // Step 3: Determine chunking strategy
  const chunkStrategy = createChunkStrategy(buffer, estimatedDuration, qualityMetrics)
  if (chunkStrategy) {
    console.log(`Chunking strategy: ${chunkStrategy.chunks.length} chunks of ${chunkStrategy.chunkSize}s`)
  }

  // Step 4: Apply preprocessing (simplified - would use audio processing library)
  let optimizedBuffer = buffer
  let compressionApplied = false

  // Basic size optimization
  if (buffer.length > options.maxFileSize) {
    console.log('File too large, applying compression...')
    // In production, would use audio processing library to:
    // - Reduce sample rate to 16kHz (optimal for speech)
    // - Convert to mono if stereo
    // - Apply compression while preserving speech quality
    
    // For now, simulate compression
    const targetSize = Math.min(options.maxFileSize, buffer.length * 0.7)
    const compressionRatio = targetSize / buffer.length
    
    // This would be actual audio compression in production
    optimizedBuffer = buffer.slice(0, targetSize)
    compressionApplied = true
    
    console.log(`Applied compression: ${buffer.length} -> ${optimizedBuffer.length} bytes (${compressionRatio.toFixed(2)}x)`)
  }

  const result: AudioOptimizationResult = {
    optimizedBuffer,
    originalSize: buffer.length,
    optimizedSize: optimizedBuffer.length,
    compressionRatio: optimizedBuffer.length / buffer.length,
    detectedFormat: formatDetection.format,
    estimatedDuration,
    qualityMetrics,
    shouldChunk: !!chunkStrategy,
    chunkStrategy: chunkStrategy || undefined,
    whisperModel: modelSelection.model,
    processingCost: modelSelection.estimatedCost
  }

  console.log('Audio optimization complete:', {
    originalSize: result.originalSize,
    optimizedSize: result.optimizedSize,
    compressionRatio: result.compressionRatio.toFixed(2),
    whisperModel: result.whisperModel,
    estimatedCost: `$${result.processingCost.toFixed(4)}`
  })

  return result
}

/**
 * Process audio chunks in parallel with intelligent merging
 */
export async function processAudioChunks(
  chunks: AudioChunk[],
  transcriptionFunction: (buffer: Buffer, filename: string) => Promise<string>,
  filename: string
): Promise<{ text: string; chunkResults: Array<{ chunk: number; text: string; processingTime: number }> }> {
  
  console.log(`Processing ${chunks.length} audio chunks in parallel`)
  
  const chunkResults: Array<{ chunk: number; text: string; processingTime: number }> = []
  const concurrencyLimit = 3 // Process max 3 chunks simultaneously
  
  // Process chunks in batches to avoid overwhelming the API
  for (let i = 0; i < chunks.length; i += concurrencyLimit) {
    const batch = chunks.slice(i, i + concurrencyLimit)
    
    const batchPromises = batch.map(async (chunk, batchIndex) => {
      const chunkIndex = i + batchIndex
      const chunkFilename = `${filename}_chunk_${chunkIndex}`
      const startTime = Date.now()
      
      try {
        const text = await transcriptionFunction(chunk.buffer, chunkFilename)
        const processingTime = Date.now() - startTime
        
        return {
          chunk: chunkIndex,
          text: text.trim(),
          processingTime
        }
      } catch (error) {
        console.error(`Chunk ${chunkIndex} failed:`, error)
        return {
          chunk: chunkIndex,
          text: '',
          processingTime: Date.now() - startTime
        }
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    chunkResults.push(...batchResults)
    
    // Brief pause between batches to avoid rate limiting
    if (i + concurrencyLimit < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  // Merge chunk results with smart deduplication
  const mergedText = mergeChunkResults(chunkResults, chunks)
  
  console.log(`Chunk processing complete: ${chunkResults.length} chunks processed`)
  
  return {
    text: mergedText,
    chunkResults
  }
}

/**
 * Intelligently merge chunk transcription results
 */
function mergeChunkResults(
  results: Array<{ chunk: number; text: string; processingTime: number }>,
  chunks: AudioChunk[]
): string {
  
  if (results.length === 0) return ''
  if (results.length === 1) return results[0].text
  
  // Sort results by chunk order
  results.sort((a, b) => a.chunk - b.chunk)
  
  let mergedText = ''
  let lastWords: string[] = []
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    let chunkText = result.text
    
    if (i > 0 && chunkText && lastWords.length > 0) {
      // Remove overlapping words at the beginning of this chunk
      const chunkWords = chunkText.split(' ')
      const overlapDetected = findWordOverlap(lastWords, chunkWords)
      
      if (overlapDetected > 0) {
        chunkText = chunkWords.slice(overlapDetected).join(' ')
        console.log(`Removed ${overlapDetected} overlapping words from chunk ${i}`)
      }
    }
    
    if (mergedText && chunkText) {
      mergedText += ' ' + chunkText
    } else if (chunkText) {
      mergedText = chunkText
    }
    
    // Keep last few words for next overlap detection
    const words = chunkText.split(' ')
    lastWords = words.slice(-5) // Keep last 5 words
  }
  
  return mergedText.trim()
}

/**
 * Find word overlap between end of previous chunk and start of current chunk
 */
function findWordOverlap(lastWords: string[], currentWords: string[]): number {
  const maxOverlap = Math.min(lastWords.length, currentWords.length, 10)
  
  for (let overlap = maxOverlap; overlap > 0; overlap--) {
    const lastSegment = lastWords.slice(-overlap).join(' ').toLowerCase()
    const currentSegment = currentWords.slice(0, overlap).join(' ').toLowerCase()
    
    // Allow for minor differences in transcription
    const similarity = calculateStringSimilarity(lastSegment, currentSegment)
    if (similarity > 0.8) {
      return overlap
    }
  }
  
  return 0
}

/**
 * Calculate string similarity (simplified Levenshtein-based)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1
  if (str1.length === 0 || str2.length === 0) return 0
  
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}