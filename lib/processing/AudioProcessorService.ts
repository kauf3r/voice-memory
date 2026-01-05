/**
 * Audio Processor Service - Handles audio transcription and processing
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { AudioProcessor, AudioProcessingResult, ProcessingContext } from './interfaces'
import { transcribeAudio } from '../openai'
import { createServerFileFromBuffer, getFilePathFromUrl, getMimeTypeFromUrl } from '../storage'
import { isVideoFile, processVideoFile } from '../video-processor'
import { AudioFormatNormalizationService } from './AudioFormatNormalizationService'
import { ContainerAnalysisService } from './ContainerAnalysisService'

export class AudioProcessorService implements AudioProcessor {
  private client: SupabaseClient
  private formatNormalizer: AudioFormatNormalizationService
  private containerAnalyzer: ContainerAnalysisService

  constructor(client: SupabaseClient) {
    this.client = client
    this.formatNormalizer = new AudioFormatNormalizationService()
    this.containerAnalyzer = new ContainerAnalysisService()
  }

  async processAudio(audioData: Buffer, mimeType: string, noteId: string): Promise<AudioProcessingResult> {
    try {
      // Determine file extension from MIME type
      const extension = this.getExtensionFromMimeType(mimeType)
      
      console.log(`Processing audio file for note ${noteId}:`)
      console.log(`  MIME type: ${mimeType}`)
      console.log(`  Extension: .${extension}`)
      console.log(`  File size: ${audioData.length} bytes`)
      
      // Log magic bytes for debugging
      const magicBytes = audioData.slice(0, 32)
      console.log(`  Magic bytes: ${Array.from(new Uint8Array(magicBytes.slice(0, 12))).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
      
      // Special logging for M4A files
      if (extension === 'm4a' || mimeType.includes('mp4')) {
        console.log(`M4A/MP4 container detected - Extension: ${extension}, MIME: ${mimeType}`)
        // Log ftyp brand if it's an MP4 container
        if (magicBytes[4] === 0x66 && magicBytes[5] === 0x74 && magicBytes[6] === 0x79 && magicBytes[7] === 0x70) {
          const brandBytes = new Uint8Array(magicBytes.buffer, magicBytes.byteOffset + 8, 4)
          const brand = String.fromCharCode(...Array.from(brandBytes))
          console.log(`  MP4 container brand: '${brand}'`)
        }
      }
      
      let audioBuffer = audioData
      let finalMimeType = mimeType
      
      // Step 1: Detailed container analysis
      console.log(`🔍 Performing detailed container analysis...`)
      const containerInfo = await this.containerAnalyzer.analyzeContainer(
        audioBuffer,
        mimeType,
        `${noteId}.${extension}`
      )
      
      console.log(`📊 Container Analysis Results:`)
      console.log(`   Format: ${containerInfo.format}`)
      console.log(`   Compatibility Score: ${containerInfo.compatibilityScore}/100`)
      console.log(`   Is Compatible: ${containerInfo.isCompatible}`)
      
      if (containerInfo.brand) {
        console.log(`   Brand: ${containerInfo.brand}`)
      }
      
      if (containerInfo.warnings.length > 0) {
        console.log(`   ⚠️ Warnings:`)
        containerInfo.warnings.forEach(warning => console.log(`      • ${warning}`))
      }
      
      if (containerInfo.recommendations.length > 0) {
        console.log(`   💡 Recommendations:`)
        containerInfo.recommendations.forEach(rec => console.log(`      • ${rec}`))
      }

      // Step 2: Normalize audio format for maximum Whisper compatibility
      console.log(`🔄 Normalizing audio format...`)
      const normalizationResult = await this.formatNormalizer.normalizeFormat(
        audioBuffer, 
        mimeType, 
        `${noteId}.${extension}`
      )
      
      if (normalizationResult.success) {
        audioBuffer = normalizationResult.buffer
        finalMimeType = normalizationResult.mimeType
        
        if (normalizationResult.warnings.length > 0) {
          console.log(`⚠️ Format normalization warnings:`)
          normalizationResult.warnings.forEach(warning => console.log(`   • ${warning}`))
        }
        
        if (normalizationResult.originalFormat !== normalizationResult.normalizedFormat) {
          console.log(`✅ Format normalized: ${normalizationResult.originalFormat} → ${normalizationResult.normalizedFormat}`)
        }
      } else {
        console.warn(`❌ Format normalization failed: ${normalizationResult.error}`)
        console.warn(`   Proceeding with original format - transcription may fail`)
      }
      
      // Step 3: Check if this is a video file that requires special processing
      if (isVideoFile(mimeType, `${noteId}.${extension}`)) {
        console.log(`Video file detected for note ${noteId}`)
        
        // Process video file to extract audio
        const videoProcessingResult = await processVideoFile(audioData, `${noteId}.${extension}`, mimeType)
        
        if (!videoProcessingResult.success) {
          throw new Error(`Video processing failed: ${videoProcessingResult.error}`)
        }
        
        // Use the extracted audio buffer
        if (videoProcessingResult.audioBuffer && videoProcessingResult.audioMimeType) {
          console.log('Audio successfully extracted from video')
          audioBuffer = videoProcessingResult.audioBuffer
          finalMimeType = videoProcessingResult.audioMimeType
        }
      }

      // Step 4: Compress large audio files for reliable upload in serverless environment
      console.log(`🔧 Step 4: Checking if compression needed (${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB)...`)
      const compressionResult = await this.formatNormalizer.compressForWhisperUpload(
        audioBuffer,
        finalMimeType,
        `${noteId}.${extension}`
      )

      if (compressionResult.success && compressionResult.compressedSize < compressionResult.originalSize) {
        audioBuffer = compressionResult.buffer
        finalMimeType = compressionResult.mimeType
        console.log(`✅ Audio compressed for upload: ${(compressionResult.originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressionResult.compressedSize / 1024 / 1024).toFixed(2)}MB`)
      }

      // Create audio file for transcription
      const audioFile = createServerFileFromBuffer(audioBuffer, `${noteId}.${extension}`, finalMimeType)

      console.log(`Sending to Whisper API: ${audioFile.name} (${audioFile.type}, ${audioFile.size} bytes)`)
      
      // Transcribe audio
      const { text: transcription, error: transcriptionError } = await this.transcribe(audioFile)
      
      if (transcriptionError || !transcription) {
        // Enhanced error logging for specific file types
        console.error(`Transcription failed for ${extension} file:`, {
          noteId,
          fileName: audioFile.name,
          fileType: audioFile.type,
          fileSize: audioFile.size,
          extension,
          detectedMimeType: finalMimeType,
          errorMessage: transcriptionError?.message
        })
        
        // Enhanced error for M4A/MP4 files with specific guidance
        if (extension === 'm4a' || finalMimeType.includes('mp4')) {
          const errorDetails = [
            `M4A/MP4 transcription failed: ${transcriptionError?.message}`,
            `Original format: ${mimeType}`,
            `Final format: ${finalMimeType}`,
            `File size: ${audioBuffer.length} bytes`,
          ]
          
          // Add container analysis results
          if (containerInfo) {
            errorDetails.push(`Container compatibility score: ${containerInfo.compatibilityScore}/100`)
            if (containerInfo.brand) {
              errorDetails.push(`MP4 brand: ${containerInfo.brand}`)
            }
            if (containerInfo.recommendations.length > 0) {
              errorDetails.push(`Recommendations: ${containerInfo.recommendations.join(', ')}`)
            }
          }
          
          // Add format analysis if normalization was attempted
          if (normalizationResult) {
            errorDetails.push(`Format normalization: ${normalizationResult.success ? 'succeeded' : 'failed'}`)
            if (normalizationResult.error) {
              errorDetails.push(`Normalization error: ${normalizationResult.error}`)
            }
          }
          
          errorDetails.push('Consider using WAV, MP3, or OGG format for better compatibility')
          
          throw new Error(errorDetails.join('. '))
        }
        
        throw new Error(`Transcription failed: ${transcriptionError?.message}`)
      }
      
      return {
        transcription,
        duration: undefined, // Could be extracted from metadata if needed
        language: undefined  // Could be detected by Whisper if needed
      }
      
    } catch (error) {
      throw error instanceof Error ? error : new Error(`Audio processing failed: ${error}`)
    }
  }

  async transcribe(audioFile: File): Promise<{ text: string; error?: Error }> {
    try {
      const result = await transcribeAudio(audioFile)
      return result
    } catch (error) {
      return {
        text: '',
        error: error instanceof Error ? error : new Error(`Transcription failed: ${error}`)
      }
    }
  }

  async downloadAudioFromStorage(audioUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      // Get audio file from storage
      const filePath = getFilePathFromUrl(audioUrl)
      const { data: audioData, error: storageError } = await this.client.storage
        .from('audio-files')
        .download(filePath)

      if (storageError || !audioData) {
        throw new Error(`Could not retrieve audio file: ${storageError?.message}`)
      }

      // Convert blob to Buffer
      const arrayBuffer = await audioData.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      
      // Detect MIME type
      const magicBytes = buffer.slice(0, 32)
      const mimeType = getMimeTypeFromUrl(audioUrl, magicBytes)
      
      return { buffer, mimeType }
      
    } catch (error) {
      throw error instanceof Error ? error : new Error(`Failed to download audio: ${error}`)
    }
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'video/mp4': 'mp4',
      'video/x-m4v': 'm4v',
      'video/quicktime': 'mov'
    }
    
    return mimeToExt[mimeType] || 'mp3'
  }

  async saveTranscriptionProgress(noteId: string, transcription: string): Promise<void> {
    try {
      await this.client
        .from('notes')
        .update({ transcription })
        .eq('id', noteId)
    } catch (error) {
      console.warn(`Failed to save transcription progress for note ${noteId}:`, error)
    }
  }
}