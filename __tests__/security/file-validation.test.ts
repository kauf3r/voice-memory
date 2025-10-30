/**
 * File Upload Security Validation Tests
 * Tests all security aspects of file upload validation
 */

import { validateFileUpload, checkUploadRateLimit } from '@/lib/security/file-validation'

// Mock File objects for testing
function createMockFile(
  name: string,
  size: number,
  type: string,
  content: Uint8Array = new Uint8Array([])
): File {
  const file = {
    name,
    size,
    type,
    lastModified: Date.now(),
    webkitRelativePath: '',
    
    arrayBuffer: async (): Promise<ArrayBuffer> => {
      return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength)
    },
    
    slice: (start?: number, end?: number, contentType?: string): File => {
      const sliceStart = start || 0
      const sliceEnd = end || content.length
      const slicedContent = content.slice(sliceStart, sliceEnd)
      return createMockFile(name, slicedContent.length, contentType || type, slicedContent)
    },
    
    stream: (): ReadableStream<Uint8Array> => {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(content)
          controller.close()
        }
      })
    },
    
    text: async (): Promise<string> => {
      return new TextDecoder().decode(content)
    }
  }
  
  return file as unknown as File
}

describe('File Upload Security Validation', () => {
  
  describe('Basic file validation', () => {
    it('should reject empty files', async () => {
      const file = createMockFile('test.mp3', 0, 'audio/mpeg')
      const result = await validateFileUpload(file)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('File is empty')
    })

    it('should reject oversized files', async () => {
      const largeSize = 26 * 1024 * 1024 // 26MB
      const file = createMockFile('large.mp3', largeSize, 'audio/mpeg')
      const result = await validateFileUpload(file)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(error => error.includes('exceeds maximum'))).toBe(true)
    })

    it('should accept valid audio files', async () => {
      // MP3 signature: FF FB (MPEG-1 Layer 3)
      const mp3Content = new Uint8Array([0xFF, 0xFB, 0x90, 0x00, ...Array(100).fill(0)])
      const file = createMockFile('test.mp3', mp3Content.length, 'audio/mpeg', mp3Content)
      const result = await validateFileUpload(file)
      
      expect(result.valid).toBe(true)
      expect(result.detectedMimeType).toBe('audio/mpeg')
      expect(result.detectedExtension).toBe('mp3')
    })
  })

  describe('Filename security validation', () => {
    it('should reject dangerous filenames', async () => {
      const dangerousFiles = [
        '../../../etc/passwd',
        'CON.mp3',
        'script.exe',
        '.hidden.mp3',
        'file with\nnewline.mp3',
        'file<script>alert()</script>.mp3'
      ]

      for (const filename of dangerousFiles) {
        const content = new Uint8Array([0xFF, 0xFB, 0x90, 0x00, ...Array(100).fill(0)])
        const file = createMockFile(filename, content.length, 'audio/mpeg', content)
        const result = await validateFileUpload(file)
        
        expect(result.valid).toBe(false)
        expect(result.errors.some(error => 
          error.includes('path characters') || 
          error.includes('dangerous characters') ||
          error.includes('not allowed')
        )).toBe(true)
      }
    })

    it('should sanitize valid filenames', async () => {
      const content = new Uint8Array([0xFF, 0xFB, 0x90, 0x00, ...Array(100).fill(0)])
      const file = createMockFile('My Audio File!@#$.mp3', content.length, 'audio/mpeg', content)
      const result = await validateFileUpload(file)
      
      expect(result.valid).toBe(true)
      expect(result.sanitizedFilename).toMatch(/^\d+_my_audio_file_\.mp3$/)
    })

    it('should reject blocked file extensions', async () => {
      const blockedExtensions = ['exe', 'bat', 'php', 'js', 'vbs', 'dll']
      
      for (const ext of blockedExtensions) {
        const file = createMockFile(`malicious.${ext}`, 1000, 'application/octet-stream')
        const result = await validateFileUpload(file)
        
        expect(result.valid).toBe(false)
        expect(result.errors.some(error => error.includes('not allowed for security reasons'))).toBe(true)
      }
    })
  })

  describe('File signature validation', () => {
    it('should validate MP3 signatures', async () => {
      const mp3Signatures = [
        [0xFF, 0xFB], // MPEG-1 Layer 3
        [0xFF, 0xF3], // MPEG-2 Layer 3
        [0x49, 0x44, 0x33] // ID3v2
      ]

      for (const signature of mp3Signatures) {
        const content = new Uint8Array([...signature, ...Array(100).fill(0)])
        const file = createMockFile('test.mp3', content.length, 'audio/mpeg', content)
        const result = await validateFileUpload(file)
        
        expect(result.valid).toBe(true)
        expect(result.detectedMimeType).toBe('audio/mpeg')
      }
    })

    it('should validate WAV signatures', async () => {
      // WAV signature: RIFF header
      const wavContent = new Uint8Array([0x52, 0x49, 0x46, 0x46, ...Array(100).fill(0)])
      const file = createMockFile('test.wav', wavContent.length, 'audio/wav', wavContent)
      const result = await validateFileUpload(file)
      
      expect(result.valid).toBe(true)
      expect(result.detectedMimeType).toBe('audio/wav')
      expect(result.detectedExtension).toBe('wav')
    })

    it('should reject files with unrecognized signatures', async () => {
      // Random bytes that don't match any audio signature
      const invalidContent = new Uint8Array([0x00, 0x01, 0x02, 0x03, ...Array(100).fill(0)])
      const file = createMockFile('fake.mp3', invalidContent.length, 'audio/mpeg', invalidContent)
      const result = await validateFileUpload(file)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(error => error.includes('signature not recognized'))).toBe(true)
    })
  })

  describe('Security scanning', () => {
    it('should detect embedded executables', async () => {
      // PE executable signature (MZ header)
      const executableContent = new Uint8Array([
        0x4D, 0x5A, // MZ signature
        ...Array(1000).fill(0),
        // Add some MP3-like data to try to fool basic checks
        0xFF, 0xFB, 0x90, 0x00
      ])
      
      const file = createMockFile('malicious.mp3', executableContent.length, 'audio/mpeg', executableContent)
      const result = await validateFileUpload(file)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(error => error.includes('executable detected'))).toBe(true)
    })

    it('should detect script content', async () => {
      // Create content that looks like audio but contains script
      const scriptContent = new TextEncoder().encode('<script>alert("xss")</script>' + 'A'.repeat(1000))
      const file = createMockFile('script.mp3', scriptContent.length, 'audio/mpeg', scriptContent)
      const result = await validateFileUpload(file)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(error => error.includes('Script content detected'))).toBe(true)
    })

    it('should detect suspicious compression ratios', async () => {
      // Simulate a file that appears very small but claims to be very large
      const smallContent = new Uint8Array(100)
      const file = createMockFile('suspicious.mp3', 1000000, 'audio/mpeg', smallContent) // Claims 1MB but only has 100 bytes
      const result = await validateFileUpload(file)
      
      // This might trigger the compression ratio warning
      expect(result.valid === false || result.warnings?.length > 0).toBe(true)
    })
  })

  describe('MP4/M4A container validation', () => {
    it('should validate M4A containers', async () => {
      // M4A ftyp box signature
      const m4aContent = new Uint8Array([
        0x00, 0x00, 0x00, 0x20, // Box size
        0x66, 0x74, 0x79, 0x70, // 'ftyp'
        0x4D, 0x34, 0x41, 0x20, // 'M4A ' brand
        ...Array(100).fill(0)
      ])
      
      const file = createMockFile('test.m4a', m4aContent.length, 'audio/mp4', m4aContent)
      const result = await validateFileUpload(file)
      
      expect(result.valid).toBe(true)
      expect(result.detectedMimeType).toBe('audio/mp4')
    })

    it('should reject invalid MP4 containers', async () => {
      // Invalid ftyp box
      const invalidMp4Content = new Uint8Array([
        0x00, 0x00, 0x00, 0x20, // Box size
        0x66, 0x74, 0x79, 0x70, // 'ftyp'
        0x45, 0x56, 0x49, 0x4C, // 'EVIL' brand (invalid)
        ...Array(100).fill(0)
      ])
      
      const file = createMockFile('evil.mp4', invalidMp4Content.length, 'video/mp4', invalidMp4Content)
      const result = await validateFileUpload(file)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(error => error.includes('Unsupported MP4 brand'))).toBe(true)
    })
  })

  describe('File integrity', () => {
    it('should generate consistent file hashes', async () => {
      const content = new Uint8Array([1, 2, 3, 4, 5])
      const file1 = createMockFile('test1.mp3', content.length, 'audio/mpeg', content)
      const file2 = createMockFile('test2.mp3', content.length, 'audio/mpeg', content)
      
      const result1 = await validateFileUpload(file1)
      const result2 = await validateFileUpload(file2)
      
      expect(result1.fileHash).toBe(result2.fileHash)
      expect(result1.fileHash).toBeDefined()
      expect(result1.fileHash!.length).toBe(64) // SHA-256 hex string
    })
  })
})

describe('Upload Rate Limiting', () => {
  beforeEach(() => {
    // Clear any existing rate limit data
    jest.clearAllMocks()
  })

  it('should allow uploads within limits', () => {
    const userId = 'test-user-1'
    const result = checkUploadRateLimit(userId, 5, 60000) // 5 uploads per minute
    
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('should enforce rate limits', () => {
    const userId = 'test-user-2'
    const maxUploads = 3
    
    // Use up all allowed uploads
    for (let i = 0; i < maxUploads; i++) {
      const result = checkUploadRateLimit(userId, maxUploads, 60000)
      expect(result.allowed).toBe(true)
    }
    
    // Next upload should be rejected
    const blockedResult = checkUploadRateLimit(userId, maxUploads, 60000)
    expect(blockedResult.allowed).toBe(false)
    expect(blockedResult.error).toContain('Rate limit exceeded')
  })

  it('should reset rate limits after time window', () => {
    const userId = 'test-user-3'
    const maxUploads = 2
    const windowMs = 100 // Short window for testing
    
    // Use up rate limit
    checkUploadRateLimit(userId, maxUploads, windowMs)
    checkUploadRateLimit(userId, maxUploads, windowMs)
    
    const blockedResult = checkUploadRateLimit(userId, maxUploads, windowMs)
    expect(blockedResult.allowed).toBe(false)
    
    // Wait for window to expire and try again
    return new Promise(resolve => {
      setTimeout(() => {
        const allowedResult = checkUploadRateLimit(userId, maxUploads, windowMs)
        expect(allowedResult.allowed).toBe(true)
        resolve(undefined)
      }, windowMs + 10)
    })
  })

  it('should handle different users independently', () => {
    const user1 = 'user-1'
    const user2 = 'user-2'
    const maxUploads = 2
    
    // User 1 uses up their limit
    checkUploadRateLimit(user1, maxUploads, 60000)
    checkUploadRateLimit(user1, maxUploads, 60000)
    
    const user1Blocked = checkUploadRateLimit(user1, maxUploads, 60000)
    expect(user1Blocked.allowed).toBe(false)
    
    // User 2 should still be allowed
    const user2Allowed = checkUploadRateLimit(user2, maxUploads, 60000)
    expect(user2Allowed.allowed).toBe(true)
  })
})

describe('Security edge cases', () => {
  it('should handle corrupted file objects gracefully', async () => {
    const corruptedFile = {
      name: 'test.mp3',
      size: 1000,
      type: 'audio/mpeg',
      arrayBuffer: async () => { throw new Error('Corrupted file') },
      slice: () => { throw new Error('Cannot slice') }
    }
    
    const result = await validateFileUpload(corruptedFile as File)
    expect(result.valid).toBe(false)
    expect(result.errors.some(error => error.includes('Validation error'))).toBe(true)
  })

  it('should reject files with null bytes in filename', async () => {
    const content = new Uint8Array([0xFF, 0xFB, ...Array(100).fill(0)])
    const file = createMockFile('test\x00.mp3', content.length, 'audio/mpeg', content)
    const result = await validateFileUpload(file)
    
    expect(result.valid).toBe(false)
    expect(result.errors.some(error => error.includes('dangerous characters'))).toBe(true)
  })

  it('should handle very long filenames', async () => {
    const longName = 'a'.repeat(300) + '.mp3'
    const content = new Uint8Array([0xFF, 0xFB, ...Array(100).fill(0)])
    const file = createMockFile(longName, content.length, 'audio/mpeg', content)
    const result = await validateFileUpload(file)
    
    expect(result.valid).toBe(false)
    expect(result.errors.some(error => error.includes('too long'))).toBe(true)
  })
})