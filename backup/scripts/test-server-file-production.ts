#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { createServerFile, createServerFileFromBuffer, createValidatedServerFile } from '../lib/storage'
import { transcribeAudio } from '../lib/openai'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

interface TestResult {
  testName: string
  success: boolean
  duration: number
  details?: string
  error?: string
}

class ProductionTester {
  private results: TestResult[] = []

  private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    console.log(`\n🧪 Testing: ${testName}`)
    const startTime = Date.now()
    
    try {
      await testFn()
      const duration = Date.now() - startTime
      this.results.push({
        testName,
        success: true,
        duration,
        details: `✅ Passed in ${duration}ms`
      })
      console.log(`✅ ${testName} - Passed (${duration}ms)`)
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.results.push({
        testName,
        success: false,
        duration,
        error: errorMessage
      })
      console.log(`❌ ${testName} - Failed: ${errorMessage}`)
    }
  }

  async testBasicFileCreation(): Promise<void> {
    const testBuffer = Buffer.from('Hello, this is test audio data for OpenAI')
    const file = createServerFileFromBuffer(testBuffer, 'test.mp3', 'audio/mpeg')
    
    // Validate basic properties
    if (file.name !== 'test.mp3') throw new Error('Name property incorrect')
    if (file.type !== 'audio/mpeg') throw new Error('Type property incorrect')
    if (file.size !== testBuffer.length) throw new Error('Size property incorrect')
    
    // Validate methods exist
    if (typeof file.arrayBuffer !== 'function') throw new Error('arrayBuffer method missing')
    if (typeof file.stream !== 'function') throw new Error('stream method missing')
    if (typeof file.slice !== 'function') throw new Error('slice method missing')
  }

  async testArrayBufferRetrieval(): Promise<void> {
    const originalData = Buffer.from('Test data for array buffer validation')
    const file = createServerFileFromBuffer(originalData, 'test.mp3', 'audio/mpeg')
    
    const arrayBuffer = await file.arrayBuffer()
    const retrievedBuffer = Buffer.from(arrayBuffer)
    
    if (!retrievedBuffer.equals(originalData)) {
      throw new Error('ArrayBuffer data does not match original')
    }
  }

  async testStreamInterface(): Promise<void> {
    const testData = Buffer.from('Stream test data')
    const file = createServerFileFromBuffer(testData, 'test.mp3', 'audio/mpeg')
    
    const stream = file.stream()
    if (!stream || typeof stream.getReader !== 'function') {
      throw new Error('Stream interface invalid')
    }
    
    const reader = stream.getReader()
    const { value, done } = await reader.read()
    
    if (done || !value) {
      throw new Error('Stream did not provide data')
    }
    
    const streamBuffer = Buffer.from(value)
    if (!streamBuffer.equals(testData)) {
      throw new Error('Stream data does not match original')
    }
  }

  async testSliceOperation(): Promise<void> {
    const testData = Buffer.from('0123456789')
    const file = createServerFileFromBuffer(testData, 'test.mp3', 'audio/mpeg')
    
    const sliced = file.slice(2, 6)
    if (sliced.size !== 4) {
      throw new Error(`Slice size incorrect: expected 4, got ${sliced.size}`)
    }
    
    const slicedBuffer = Buffer.from(await sliced.arrayBuffer())
    const expectedSlice = testData.slice(2, 6)
    
    if (!slicedBuffer.equals(expectedSlice)) {
      throw new Error('Sliced data does not match expected')
    }
  }

  async testFormDataCompatibility(): Promise<void> {
    const testData = Buffer.from('FormData compatibility test')
    const file = createServerFileFromBuffer(testData, 'test.mp3', 'audio/mpeg')
    
    const formData = new FormData()
    formData.append('file', file as any)
    
    // Verify FormData can be created and contains the file
    const entries = Array.from(formData.entries())
    if (entries.length !== 1 || entries[0][0] !== 'file') {
      throw new Error('FormData creation failed')
    }
  }

  async testValidatedServerFile(): Promise<void> {
    const testData = Buffer.from('Validation test data')
    
    // Test valid file
    const validResult = createValidatedServerFile(testData, 'test.mp3', 'audio/mpeg')
    if (!validResult.isValid) {
      throw new Error(`Valid file marked as invalid: ${validResult.errors.join(', ')}`)
    }
    
    // Test invalid empty filename
    const invalidFilename = createValidatedServerFile(testData, '', 'audio/mpeg')
    if (invalidFilename.isValid) {
      throw new Error('Empty filename should be invalid')
    }
    
    // Test invalid MIME type
    const invalidMime = createValidatedServerFile(testData, 'test.mp3', 'invalid')
    if (invalidMime.isValid) {
      throw new Error('Invalid MIME type should be invalid')
    }
    
    // Test oversized file
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024) // 26MB
    const oversized = createValidatedServerFile(largeBuffer, 'large.mp3', 'audio/mpeg')
    if (oversized.isValid) {
      throw new Error('Oversized file should be invalid')
    }
  }

  async testPerformanceWithLargeFiles(): Promise<void> {
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024) // 10MB
    
    const startTime = Date.now()
    const file = createServerFileFromBuffer(largeBuffer, 'large.mp3', 'audio/mpeg')
    const creationTime = Date.now() - startTime
    
    if (creationTime > 1000) {
      throw new Error(`File creation too slow: ${creationTime}ms`)
    }
    
    const arrayBufferStart = Date.now()
    await file.arrayBuffer()
    const arrayBufferTime = Date.now() - arrayBufferStart
    
    if (arrayBufferTime > 2000) {
      throw new Error(`ArrayBuffer conversion too slow: ${arrayBufferTime}ms`)
    }
  }

  async testOpenAICompatibility(): Promise<void> {
    // Only run if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.log('⏭️  Skipping OpenAI test - no API key configured')
      return
    }
    
    // Create a minimal audio file buffer (not real audio, just for API compatibility test)
    const mockAudioData = Buffer.alloc(1024) // 1KB of zeros
    const file = createServerFileFromBuffer(mockAudioData, 'test.mp3', 'audio/mpeg')
    
    try {
      // This will likely fail due to invalid audio data, but we're testing the file interface
      await transcribeAudio(file)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // We expect this to fail due to invalid audio, but it should fail on audio processing,
      // not on file interface issues
      if (errorMessage.includes('file') && !errorMessage.includes('audio')) {
        throw new Error(`OpenAI API rejected file interface: ${errorMessage}`)
      }
      
      // If it fails on audio processing, that's expected with our mock data
      console.log('  📝 Note: OpenAI rejected mock audio data (expected)')
    }
  }

  async testBlobToBufferCompatibility(): Promise<void> {
    const originalBuffer = Buffer.from('Blob compatibility test')
    const blob = new Blob([originalBuffer], { type: 'audio/mpeg' })
    
    // Test original createServerFile function
    const fileFromBlob = createServerFile(blob, 'test.mp3', 'audio/mpeg')
    const retrievedBuffer = Buffer.from(await fileFromBlob.arrayBuffer())
    
    if (!retrievedBuffer.equals(originalBuffer)) {
      throw new Error('Blob conversion does not preserve data')
    }
  }

  async testMemoryLeaks(): Promise<void> {
    const initialMemory = process.memoryUsage().heapUsed
    
    // Create and destroy many files
    for (let i = 0; i < 100; i++) {
      const buffer = Buffer.alloc(1024 * 1024) // 1MB each
      const file = createServerFileFromBuffer(buffer, `test-${i}.mp3`, 'audio/mpeg')
      await file.arrayBuffer() // Use the file
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    
    const finalMemory = process.memoryUsage().heapUsed
    const memoryIncrease = finalMemory - initialMemory
    
    // Allow some memory increase but not excessive
    if (memoryIncrease > 50 * 1024 * 1024) { // 50MB threshold
      throw new Error(`Potential memory leak detected: ${Math.round(memoryIncrease / 1024 / 1024)}MB increase`)
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Production File Tests for OpenAI Compatibility')
    console.log('=' .repeat(60))
    
    const tests = [
      { name: 'Basic File Creation', fn: () => this.testBasicFileCreation() },
      { name: 'ArrayBuffer Retrieval', fn: () => this.testArrayBufferRetrieval() },
      { name: 'Stream Interface', fn: () => this.testStreamInterface() },
      { name: 'Slice Operation', fn: () => this.testSliceOperation() },
      { name: 'FormData Compatibility', fn: () => this.testFormDataCompatibility() },
      { name: 'Validated Server File', fn: () => this.testValidatedServerFile() },
      { name: 'Performance with Large Files', fn: () => this.testPerformanceWithLargeFiles() },
      { name: 'OpenAI API Compatibility', fn: () => this.testOpenAICompatibility() },
      { name: 'Blob to Buffer Compatibility', fn: () => this.testBlobToBufferCompatibility() },
      { name: 'Memory Leak Detection', fn: () => this.testMemoryLeaks() }
    ]
    
    for (const test of tests) {
      await this.runTest(test.name, test.fn)
    }
    
    this.printSummary()
  }

  private printSummary(): void {
    console.log('\n' + '=' .repeat(60))
    console.log('📊 Test Summary')
    console.log('=' .repeat(60))
    
    const passed = this.results.filter(r => r.success).length
    const failed = this.results.filter(r => r.success === false).length
    const totalTime = this.results.reduce((sum, r) => sum + r.duration, 0)
    
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`⏱️  Total Time: ${totalTime}ms`)
    console.log(`📈 Success Rate: ${Math.round((passed / this.results.length) * 100)}%`)
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:')
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`  • ${r.testName}: ${r.error}`))
    }
    
    console.log('\n🏁 Production testing complete!')
    
    if (failed > 0) {
      process.exit(1)
    }
  }
}

async function main(): Promise<void> {
  const tester = new ProductionTester()
  await tester.runAllTests()
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { ProductionTester } 