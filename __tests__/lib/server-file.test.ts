import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { createServerFile, createServerFileFromBuffer } from '@/lib/storage'

describe('createServerFile', () => {
  // Test data
  const testBuffer = Buffer.from('test audio data')
  const testBlob = new Blob([testBuffer], { type: 'audio/mpeg' })
  const filename = 'test-audio.mp3'
  const mimeType = 'audio/mpeg'

  beforeEach(() => {
    // Reset any mocks
    jest.clearAllMocks()
  })

  describe('createServerFile function', () => {
    it('should create a File object with correct properties', () => {
      const file = createServerFile(testBlob, filename, mimeType)
      
      expect(file.name).toBe(filename)
      expect(file.type).toBe(mimeType)
      expect(file.size).toBe(testBlob.size)
    })

    it('should have required File interface methods', () => {
      const file = createServerFile(testBlob, filename, mimeType)
      
      expect(typeof file.arrayBuffer).toBe('function')
      expect(typeof file.stream).toBe('function')
      expect(typeof file.text).toBe('function')
      expect(typeof file.slice).toBe('function')
    })

    it('should return arrayBuffer data correctly', async () => {
      const file = createServerFile(testBlob, filename, mimeType)
      const arrayBuffer = await file.arrayBuffer()
      const resultBuffer = Buffer.from(arrayBuffer)
      
      expect(resultBuffer.equals(testBuffer)).toBe(true)
    })

    it('should support slice operations', () => {
      const file = createServerFile(testBlob, filename, mimeType)
      const sliced = file.slice(0, 4)
      
      expect(sliced).toBeDefined()
      expect(typeof sliced.slice).toBe('function')
      expect(sliced.size).toBe(4)
    })

    it('should work with different MIME types', () => {
      const types = ['audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/aac']
      
      types.forEach(type => {
        const file = createServerFile(testBlob, `test.${type.split('/')[1]}`, type)
        expect(file.type).toBe(type)
      })
    })

    it('should handle empty blobs', () => {
      const emptyBlob = new Blob([], { type: mimeType })
      const file = createServerFile(emptyBlob, filename, mimeType)
      
      expect(file.size).toBe(0)
      expect(file.name).toBe(filename)
      expect(file.type).toBe(mimeType)
    })

    it('should handle large files', () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024) // 10MB
      const largeBlob = new Blob([largeBuffer], { type: mimeType })
      const file = createServerFile(largeBlob, filename, mimeType)
      
      expect(file.size).toBe(largeBlob.size)
      expect(file.name).toBe(filename)
    })
  })

  describe('createServerFileFromBuffer function', () => {
    it('should create a File object from Buffer with correct properties', () => {
      const file = createServerFileFromBuffer(testBuffer, filename, mimeType)
      
      expect(file.name).toBe(filename)
      expect(file.type).toBe(mimeType)
      expect(file.size).toBe(testBuffer.length)
    })

    it('should have OpenAI-compatible interface', () => {
      const file = createServerFileFromBuffer(testBuffer, filename, mimeType)
      
      // These are the key properties OpenAI SDK expects
      expect(file).toHaveProperty('name')
      expect(file).toHaveProperty('type')
      expect(file).toHaveProperty('size')
      expect(typeof file.arrayBuffer).toBe('function')
      expect(typeof file.stream).toBe('function')
    })

    it('should return correct arrayBuffer data', async () => {
      const file = createServerFileFromBuffer(testBuffer, filename, mimeType)
      const arrayBuffer = await file.arrayBuffer()
      const resultBuffer = Buffer.from(arrayBuffer)
      
      expect(resultBuffer.equals(testBuffer)).toBe(true)
    })

    it('should support readable stream interface', () => {
      const file = createServerFileFromBuffer(testBuffer, filename, mimeType)
      const stream = file.stream()
      
      expect(stream).toBeDefined()
      expect(typeof stream.getReader).toBe('function')
    })

    it('should handle different buffer sizes', () => {
      const sizes = [0, 1024, 1024 * 1024, 10 * 1024 * 1024]
      
      sizes.forEach(size => {
        const buffer = Buffer.alloc(size)
        const file = createServerFileFromBuffer(buffer, filename, mimeType)
        expect(file.size).toBe(size)
      })
    })

    it('should preserve MIME type correctly', () => {
      const types = [
        'audio/mpeg',
        'audio/wav', 
        'audio/m4a',
        'audio/aac',
        'audio/ogg',
        'audio/webm'
      ]
      
      types.forEach(type => {
        const file = createServerFileFromBuffer(testBuffer, `test.${type.split('/')[1]}`, type)
        expect(file.type).toBe(type)
      })
    })
  })

  describe('OpenAI API Compatibility', () => {
    it('should be compatible with OpenAI file upload interface', () => {
      const file = createServerFileFromBuffer(testBuffer, filename, mimeType)
      
      // Mock OpenAI SDK expectations
      const mockOpenAIFile = {
        name: expect.any(String),
        type: expect.any(String),
        size: expect.any(Number),
        arrayBuffer: expect.any(Function),
        stream: expect.any(Function)
      }
      
      expect(file).toMatchObject(mockOpenAIFile)
    })

    it('should work with FormData (OpenAI SDK requirement)', () => {
      const file = createServerFileFromBuffer(testBuffer, filename, mimeType)
      const formData = new FormData()
      
      expect(() => {
        formData.append('file', file as any)
      }).not.toThrow()
    })

    it('should maintain file integrity for audio processing', async () => {
      // Test with actual audio-like data patterns
      const audioHeaderMp3 = Buffer.from([0xFF, 0xFB, 0x90, 0x00]) // MP3 header
      const paddedBuffer = Buffer.concat([audioHeaderMp3, Buffer.alloc(1000)])
      
      const file = createServerFileFromBuffer(paddedBuffer, 'test.mp3', 'audio/mpeg')
      const retrievedBuffer = Buffer.from(await file.arrayBuffer())
      
      expect(retrievedBuffer.equals(paddedBuffer)).toBe(true)
      expect(retrievedBuffer.slice(0, 4).equals(audioHeaderMp3)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid filename gracefully', () => {
      expect(() => {
        createServerFileFromBuffer(testBuffer, '', mimeType)
      }).not.toThrow()
      
      const file = createServerFileFromBuffer(testBuffer, '', mimeType)
      expect(file.name).toBe('')
    })

    it('should handle invalid MIME type gracefully', () => {
      expect(() => {
        createServerFileFromBuffer(testBuffer, filename, 'invalid/type')
      }).not.toThrow()
      
      const file = createServerFileFromBuffer(testBuffer, filename, 'invalid/type')
      expect(file.type).toBe('invalid/type')
    })

    it('should handle null or undefined inputs gracefully', () => {
      expect(() => {
        createServerFileFromBuffer(Buffer.alloc(0), filename, mimeType)
      }).not.toThrow()
    })
  })

  describe('Performance', () => {
    it('should handle large files efficiently', async () => {
      const largeBuffer = Buffer.alloc(25 * 1024 * 1024) // 25MB
      
      const startTime = Date.now()
      const file = createServerFileFromBuffer(largeBuffer, 'large.mp3', mimeType)
      const createTime = Date.now() - startTime
      
      expect(createTime).toBeLessThan(1000) // Should create in less than 1 second
      expect(file.size).toBe(largeBuffer.length)
    })

    it('should not hold references to original buffer after creation', () => {
      let buffer = Buffer.from('test data')
      const file = createServerFileFromBuffer(buffer, filename, mimeType)
      
      // Clear original reference
      buffer = null as any
      
      // File should still work
      expect(file.size).toBeGreaterThan(0)
      expect(file.name).toBe(filename)
    })
  })
})

describe('Production Environment Tests', () => {
  // These tests simulate production environment conditions
  
  it('should work in serverless environment without global File constructor', () => {
    // Temporarily remove File constructor to simulate serverless environment
    const originalFile = global.File
    delete (global as any).File
    
    try {
      const file = createServerFileFromBuffer(testBuffer, filename, mimeType)
      expect(file.name).toBe(filename)
      expect(file.type).toBe(mimeType)
      expect(file.size).toBe(testBuffer.length)
    } finally {
      // Restore File constructor
      global.File = originalFile
    }
  })

  it('should be JSON serializable for debugging', () => {
    const file = createServerFileFromBuffer(testBuffer, filename, mimeType)
    
    const serializable = {
      name: file.name,
      type: file.type,
      size: file.size
    }
    
    expect(() => JSON.stringify(serializable)).not.toThrow()
  })
})

const testBuffer = Buffer.from('test audio data')
const filename = 'test-audio.mp3' 
const mimeType = 'audio/mpeg' 