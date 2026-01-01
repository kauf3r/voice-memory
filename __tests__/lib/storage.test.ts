import { jest } from '@jest/globals'
import { 
  uploadAudioFile, 
  getSignedAudioUrl, 
  deleteAudioFile,
  getFilePathFromUrl,
  getMimeTypeFromUrl,
  createServerFile,
  createServerFileFromBuffer,
  createValidatedServerFile,
  validateAudioFile,
  generateAudioFilename,
  getExtensionFromMimeType
} from '@/lib/storage'
import { configureMockClient } from '@supabase/supabase-js'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: null // Will be set by configureMockClient
}))

describe('Storage Module', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = configureMockClient({ authenticated: true })
  })

  describe('uploadAudioFile', () => {
    const mockFile = new File(['test audio content'], 'test.mp3', { 
      type: 'audio/mp3' 
    })
    const userId = 'test-user-id'

    it('should successfully upload audio file', async () => {
      const expectedPath = `${userId}/123456789.mp3`
      const expectedUrl = 'https://example.com/audio/file.mp3'

      // Mock Date.now for predictable file naming
      const mockTimestamp = 123456789
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp)

      mockSupabase.storage.from().upload.mockResolvedValue({
        data: { path: expectedPath },
        error: null
      })

      mockSupabase.storage.from().getPublicUrl.mockReturnValue({
        data: { publicUrl: expectedUrl }
      })

      const result = await uploadAudioFile(mockFile, userId)

      expect(result.url).toBe(expectedUrl)
      expect(result.error).toBeNull()
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('audio-files')
      expect(mockSupabase.storage.from().upload).toHaveBeenCalledWith(
        expectedPath,
        mockFile,
        {
          cacheControl: '3600',
          upsert: false,
        }
      )
    })

    it('should handle upload errors', async () => {
      const uploadError = new Error('Upload failed')
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: null,
        error: uploadError
      })

      const result = await uploadAudioFile(mockFile, userId)

      expect(result.url).toBeNull()
      expect(result.error).toEqual(uploadError)
    })

    it('should use custom supabase client when provided', async () => {
      const customSupabase = configureMockClient({ authenticated: true })
      customSupabase.storage.from().upload.mockResolvedValue({
        data: { path: 'test-path' },
        error: null
      })
      customSupabase.storage.from().getPublicUrl.mockReturnValue({
        data: { publicUrl: 'test-url' }
      })

      const result = await uploadAudioFile(mockFile, userId, customSupabase)

      expect(result.url).toBe('test-url')
      expect(customSupabase.storage.from).toHaveBeenCalledWith('audio-files')
    })

    it('should generate unique filenames with timestamp', async () => {
      const mockTimestamp1 = 123456789
      const mockTimestamp2 = 123456790

      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(mockTimestamp1)
        .mockReturnValueOnce(mockTimestamp2)

      mockSupabase.storage.from().upload.mockResolvedValue({
        data: { path: 'test-path' },
        error: null
      })
      mockSupabase.storage.from().getPublicUrl.mockReturnValue({
        data: { publicUrl: 'test-url' }
      })

      await uploadAudioFile(mockFile, userId)
      await uploadAudioFile(mockFile, userId)

      expect(mockSupabase.storage.from().upload).toHaveBeenNthCalledWith(
        1,
        `${userId}/${mockTimestamp1}.mp3`,
        mockFile,
        expect.any(Object)
      )
      expect(mockSupabase.storage.from().upload).toHaveBeenNthCalledWith(
        2,
        `${userId}/${mockTimestamp2}.mp3`,
        mockFile,
        expect.any(Object)
      )
    })
  })

  describe('getSignedAudioUrl', () => {
    const filePath = 'user-id/audio-file.mp3'

    it('should successfully create signed URL', async () => {
      const expectedSignedUrl = 'https://example.com/signed-url'
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: { signedUrl: expectedSignedUrl },
        error: null
      })

      const result = await getSignedAudioUrl(filePath)

      expect(result.url).toBe(expectedSignedUrl)
      expect(result.error).toBeNull()
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('audio-files')
      expect(mockSupabase.storage.from().createSignedUrl).toHaveBeenCalledWith(filePath, 3600)
    })

    it('should handle signed URL creation errors', async () => {
      const signedUrlError = new Error('Signed URL creation failed')
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: null,
        error: signedUrlError
      })

      const result = await getSignedAudioUrl(filePath)

      expect(result.url).toBeNull()
      expect(result.error).toEqual(signedUrlError)
    })

    it('should handle null data response', async () => {
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: null,
        error: null
      })

      const result = await getSignedAudioUrl(filePath)

      expect(result.url).toBeNull()
      expect(result.error).toBeNull()
    })
  })

  describe('deleteAudioFile', () => {
    const filePath = 'user-id/audio-file.mp3'

    it('should successfully delete audio file', async () => {
      mockSupabase.storage.from().remove.mockResolvedValue({
        data: null,
        error: null
      })

      const result = await deleteAudioFile(filePath)

      expect(result.error).toBeNull()
      expect(mockSupabase.storage.from).toHaveBeenCalledWith('audio-files')
      expect(mockSupabase.storage.from().remove).toHaveBeenCalledWith([filePath])
    })

    it('should handle deletion errors', async () => {
      const deleteError = new Error('Deletion failed')
      mockSupabase.storage.from().remove.mockResolvedValue({
        data: null,
        error: deleteError
      })

      const result = await deleteAudioFile(filePath)

      expect(result.error).toEqual(deleteError)
    })
  })

  describe('getFilePathFromUrl', () => {
    it('should extract file path from valid Supabase URL', () => {
      const url = 'https://example.supabase.co/storage/v1/object/public/audio-files/user-id/file.mp3'
      const expectedPath = 'user-id/file.mp3'

      const result = getFilePathFromUrl(url)

      expect(result).toBe(expectedPath)
    })

    it('should handle URL without audio-files bucket', () => {
      const url = 'https://example.com/other-bucket/file.mp3'

      const result = getFilePathFromUrl(url)

      expect(result).toBe('')
    })

    it('should handle invalid URLs', () => {
      const invalidUrl = 'not-a-valid-url'

      const result = getFilePathFromUrl(invalidUrl)

      expect(result).toBe('')
    })

    it('should handle nested paths correctly', () => {
      const url = 'https://example.supabase.co/storage/v1/object/public/audio-files/user-id/folder/file.mp3'
      const expectedPath = 'user-id/folder/file.mp3'

      const result = getFilePathFromUrl(url)

      expect(result).toBe(expectedPath)
    })
  })

  describe('getMimeTypeFromUrl', () => {
    it('should return correct MIME type for MP3 files', () => {
      const url = 'https://example.com/file.mp3'
      
      const result = getMimeTypeFromUrl(url)
      
      expect(result).toBe('audio/mpeg')
    })

    it('should return audio/mp4 for M4A files', () => {
      const url = 'https://example.com/file.m4a'
      
      const result = getMimeTypeFromUrl(url)
      
      expect(result).toBe('audio/mp4')
    })

    it('should return correct MIME type for WAV files', () => {
      const url = 'https://example.com/file.wav'
      
      const result = getMimeTypeFromUrl(url)
      
      expect(result).toBe('audio/wav')
    })

    it('should use magic bytes for MP4 detection when provided', () => {
      const url = 'https://example.com/file.mp4'
      // Mock MP4 magic bytes (ftyp box with M4A brand)
      const magicBytes = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4D, 0x34, 0x41, 0x20])
      
      const result = getMimeTypeFromUrl(url, magicBytes)
      
      expect(result).toBe('audio/mp4')
    })

    it('should use magic bytes for MP3 detection', () => {
      const url = 'https://example.com/file.unknown'
      // Mock MP3 magic bytes (ID3v2 tag)
      const magicBytes = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
      
      const result = getMimeTypeFromUrl(url, magicBytes)
      
      expect(result).toBe('audio/mpeg')
    })

    it('should fallback to audio/mpeg for unknown extensions', () => {
      const url = 'https://example.com/file.unknown'
      
      const result = getMimeTypeFromUrl(url)
      
      expect(result).toBe('audio/mpeg')
    })
  })

  describe('createServerFileFromBuffer', () => {
    it('should create File object with correct properties', () => {
      const buffer = Buffer.from('test audio content')
      const filename = 'test.mp3'
      const mimeType = 'audio/mpeg'

      const file = createServerFileFromBuffer(buffer, filename, mimeType)

      expect(file.name).toBe(filename)
      expect(file.type).toBe(mimeType)
      expect(file.size).toBe(buffer.length)
      expect(typeof file.arrayBuffer).toBe('function')
      expect(typeof file.stream).toBe('function')
      expect(typeof file.text).toBe('function')
      expect(typeof file.slice).toBe('function')
    })

    it('should provide working arrayBuffer method', async () => {
      const testContent = 'test audio content'
      const buffer = Buffer.from(testContent)
      const file = createServerFileFromBuffer(buffer, 'test.mp3', 'audio/mpeg')

      const arrayBuffer = await file.arrayBuffer()
      const resultBuffer = Buffer.from(arrayBuffer)

      expect(resultBuffer.equals(buffer)).toBe(true)
    })

    it('should provide working text method', async () => {
      const testContent = 'test audio content'
      const buffer = Buffer.from(testContent)
      const file = createServerFileFromBuffer(buffer, 'test.mp3', 'audio/mpeg')

      const text = await file.text()

      expect(text).toBe(testContent)
    })

    it('should provide working slice method', () => {
      const buffer = Buffer.from('0123456789')
      const file = createServerFileFromBuffer(buffer, 'test.mp3', 'audio/mpeg')

      const slicedFile = file.slice(2, 5)

      expect(slicedFile.name).toBe('test.mp3')
      expect(slicedFile.size).toBe(3)
    })

    it('should provide working bytes method', async () => {
      const buffer = Buffer.from('test content')
      const file = createServerFileFromBuffer(buffer, 'test.mp3', 'audio/mpeg')

      const bytes = await file.bytes()

      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBe(buffer.length)
    })
  })

  describe('createValidatedServerFile', () => {
    it('should create valid file from Buffer', () => {
      const buffer = Buffer.from('test audio content')
      const filename = 'test.mp3'
      const mimeType = 'audio/mpeg'

      const result = createValidatedServerFile(buffer, filename, mimeType)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.file.name).toBe(filename)
      expect(result.file.type).toBe(mimeType)
    })

    it('should validate filename', () => {
      const buffer = Buffer.from('test content')
      
      const result = createValidatedServerFile(buffer, '', 'audio/mpeg')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Filename cannot be empty')
    })

    it('should validate MIME type format', () => {
      const buffer = Buffer.from('test content')
      
      const result = createValidatedServerFile(buffer, 'test.mp3', 'invalid-mime')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid MIME type format')
    })

    it('should validate empty buffer', () => {
      const buffer = Buffer.from('')
      
      const result = createValidatedServerFile(buffer, 'test.mp3', 'audio/mpeg')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('File cannot be empty')
    })

    it('should validate file size limit', () => {
      const largeBuffer = Buffer.alloc(26 * 1024 * 1024) // 26MB
      
      const result = createValidatedServerFile(largeBuffer, 'test.mp3', 'audio/mpeg')

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('File size exceeds OpenAI limit of 25MB')
    })

    it('should handle ArrayBuffer input', () => {
      const arrayBuffer = new ArrayBuffer(10)
      const view = new Uint8Array(arrayBuffer)
      view.set([1, 2, 3, 4, 5])

      const result = createValidatedServerFile(arrayBuffer, 'test.mp3', 'audio/mpeg')

      expect(result.isValid).toBe(true)
      expect(result.file.size).toBe(10)
    })

    it('should handle Blob input', () => {
      const blob = new Blob(['test content'], { type: 'audio/mpeg' })

      const result = createValidatedServerFile(blob, 'test.mp3', 'audio/mpeg')

      expect(result.isValid).toBe(true)
      expect(result.file.name).toBe('test.mp3')
    })
  })

  describe('validateAudioFile', () => {
    it('should validate supported audio file', () => {
      const file = new File(['test content'], 'test.mp3', { type: 'audio/mpeg' })

      const result = validateAudioFile(file)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject oversized files', () => {
      const largeFile = new File([new ArrayBuffer(26 * 1024 * 1024)], 'large.mp3', { type: 'audio/mpeg' })

      const result = validateAudioFile(largeFile)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('File size exceeds 25MB limit')
    })

    it('should reject unsupported file types', () => {
      const textFile = new File(['test'], 'test.txt', { type: 'text/plain' })

      const result = validateAudioFile(textFile)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Unsupported audio format')
    })

    it('should validate all supported audio formats', () => {
      const supportedTypes = [
        'audio/mpeg',
        'audio/mp4',
        'audio/wav',
        'audio/aac',
        'audio/ogg',
        'audio/webm'
      ]

      supportedTypes.forEach(type => {
        const file = new File(['test'], 'test', { type })
        const result = validateAudioFile(file)
        expect(result.valid).toBe(true)
      })
    })
  })

  describe('generateAudioFilename', () => {
    it('should generate unique filename with timestamp', () => {
      const mockTimestamp = 123456789
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp)

      const originalName = 'my-audio-file.mp3'
      const userId = 'user-123'

      const result = generateAudioFilename(originalName, userId)

      expect(result).toBe(`${userId}/${mockTimestamp}_my-audio-file.mp3.mp3`)
    })

    it('should sanitize filename with special characters', () => {
      const mockTimestamp = 123456789
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp)

      const originalName = 'my audio file!@#$.mp3'
      const userId = 'user-123'

      const result = generateAudioFilename(originalName, userId)

      expect(result).toBe(`${userId}/${mockTimestamp}_my_audio_file____.mp3.mp3`)
    })

    it('should handle files without extension', () => {
      const mockTimestamp = 123456789
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp)

      const originalName = 'audiofile'
      const userId = 'user-123'

      const result = generateAudioFilename(originalName, userId)

      expect(result).toBe(`${userId}/${mockTimestamp}_audiofile.mp3`)
    })
  })

  describe('getExtensionFromMimeType', () => {
    it('should return correct extensions for supported MIME types', () => {
      const mimeToExtMap = {
        'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a',
        'audio/wav': 'wav',
        'audio/aac': 'aac',
        'audio/ogg': 'ogg',
        'audio/webm': 'webm'
      }

      Object.entries(mimeToExtMap).forEach(([mimeType, expectedExt]) => {
        const result = getExtensionFromMimeType(mimeType)
        expect(result).toBe(expectedExt)
      })
    })

    it('should default to mp3 for unknown MIME types', () => {
      const result = getExtensionFromMimeType('audio/unknown')
      
      expect(result).toBe('mp3')
    })

    it('should default to mp3 for empty MIME type', () => {
      const result = getExtensionFromMimeType('')
      
      expect(result).toBe('mp3')
    })
  })
})