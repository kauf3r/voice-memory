#!/usr/bin/env tsx
/**
 * Voice Memory Auto-Uploader
 * 
 * Watches the audio-exports folder for new audio files and automatically
 * uploads them to Voice Memory for AI analysis.
 * 
 * Usage: npm run watch-uploads
 *        or: tsx scripts/auto-uploader.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as chokidar from 'chokidar'
import { createReadStream } from 'fs'
// Load environment variables
import 'dotenv/config'

// Configuration
const WATCH_DIR = path.join(process.cwd(), 'audio-exports')
const PROCESSED_DIR = path.join(WATCH_DIR, 'processed')
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const SUPPORTED_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.aac', '.ogg', '.webm', '.mp4']
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

// Store processing state to avoid duplicate uploads
const processingFiles = new Set<string>()
const processedFiles = new Set<string>()

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
}

// Authentication state
let authToken: string | null = null

function log(message: string, color: string = colors.reset) {
  const timestamp = new Date().toLocaleTimeString()
  console.log(`${colors.gray}[${timestamp}]${colors.reset} ${color}${message}${colors.reset}`)
}

function logError(message: string, error?: any) {
  const timestamp = new Date().toLocaleTimeString()
  console.error(`${colors.gray}[${timestamp}]${colors.reset} ${colors.red}❌ ${message}${colors.reset}`)
  if (error) {
    console.error(colors.gray, error)
  }
}

function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(2)} MB`
}

async function ensureProcessedDirectory() {
  if (!fs.existsSync(PROCESSED_DIR)) {
    fs.mkdirSync(PROCESSED_DIR, { recursive: true })
    log(`Created processed directory: ${PROCESSED_DIR}`, colors.green)
  }
}

async function getAuthToken(): Promise<string | null> {
  // Check if we have an auth token in environment
  if (process.env.VOICE_MEMORY_AUTH_TOKEN) {
    return process.env.VOICE_MEMORY_AUTH_TOKEN
  }
  
  // Try to read from a local auth file
  const authFile = path.join(process.cwd(), '.voice-memory-auth')
  if (fs.existsSync(authFile)) {
    try {
      const token = fs.readFileSync(authFile, 'utf-8').trim()
      if (token) return token
    } catch (error) {
      logError('Failed to read auth file', error)
    }
  }
  
  return null
}

async function checkAuthentication(): Promise<boolean> {
  if (!authToken) {
    authToken = await getAuthToken()
  }
  
  if (!authToken) {
    log('⚠️  No authentication token found', colors.yellow)
    log('Please set VOICE_MEMORY_AUTH_TOKEN in your .env file', colors.yellow)
    log('Or create a .voice-memory-auth file with your auth token', colors.yellow)
    log('Get your token by logging into Voice Memory and checking browser DevTools', colors.gray)
    return false
  }
  
  // Verify token is valid
  try {
    const response = await fetch(`${API_BASE_URL}/api/notes`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })
    
    if (response.status === 401) {
      logError('Authentication token is invalid or expired')
      authToken = null
      return false
    }
    
    if (response.ok) {
      log('✅ Authentication verified', colors.green)
      return true
    }
  } catch (error) {
    logError('Failed to verify authentication', error)
  }
  
  return false
}

async function uploadFile(filePath: string): Promise<boolean> {
  const fileName = path.basename(filePath)
  const fileSize = fs.statSync(filePath).size
  
  log(`📤 Uploading: ${fileName} (${formatFileSize(fileSize)})`, colors.cyan)
  
  try {
    // Create form data
    const formData = new FormData()
    const fileContent = fs.readFileSync(filePath)
    const blob = new Blob([fileContent], { type: getMimeType(filePath) })
    formData.append('file', blob, fileName)
    
    // Upload to API
    const uploadResponse = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: formData
    })
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.text()
      throw new Error(`Upload failed: ${uploadResponse.status} - ${error}`)
    }
    
    const uploadResult = await uploadResponse.json()
    log(`✅ Upload successful: ${fileName}`, colors.green)
    
    // Trigger processing
    if (uploadResult.note?.id) {
      log(`🔄 Processing note...`, colors.blue)
      
      const processResponse = await fetch(`${API_BASE_URL}/api/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ noteId: uploadResult.note.id })
      })
      
      if (processResponse.ok) {
        const processResult = await processResponse.json()
        log(`✅ Processing complete: ${fileName}`, colors.green)
        
        if (processResult.note?.analysis) {
          // Show brief analysis summary
          const analysis = processResult.note.analysis
          log(`📊 Analysis:`, colors.bright)
          log(`   Sentiment: ${analysis.sentiment?.classification || 'Unknown'}`, colors.gray)
          log(`   Topic: ${analysis.focusTopics?.primary || 'Unknown'}`, colors.gray)
          log(`   Tasks: ${analysis.tasks?.myTasks?.length || 0} personal, ${analysis.tasks?.delegatedTasks?.length || 0} delegated`, colors.gray)
          log(`   Insights: ${analysis.keyIdeas?.length || 0} key ideas`, colors.gray)
        }
      } else {
        logError('Processing failed', await processResponse.text())
      }
    }
    
    return true
  } catch (error) {
    logError(`Failed to upload ${fileName}`, error)
    return false
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.webm': 'audio/webm',
    '.mp4': 'audio/mp4'
  }
  return mimeTypes[ext] || 'audio/mpeg'
}

async function processFile(filePath: string) {
  const fileName = path.basename(filePath)
  
  // Check if already processing or processed
  if (processingFiles.has(filePath) || processedFiles.has(filePath)) {
    return
  }
  
  // Check file extension
  const ext = path.extname(filePath).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    log(`⚠️  Skipping unsupported file: ${fileName}`, colors.yellow)
    return
  }
  
  // Check file size
  const stats = fs.statSync(filePath)
  if (stats.size > MAX_FILE_SIZE) {
    logError(`File too large: ${fileName} (${formatFileSize(stats.size)})`)
    log(`Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`, colors.yellow)
    return
  }
  
  // Wait a moment to ensure file is completely written
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Mark as processing
  processingFiles.add(filePath)
  
  try {
    // Upload and process
    const success = await uploadFile(filePath)
    
    if (success) {
      processedFiles.add(filePath)
      
      // Move to processed folder
      const processedPath = path.join(PROCESSED_DIR, fileName)
      fs.renameSync(filePath, processedPath)
      log(`📁 Moved to processed folder: ${fileName}`, colors.gray)
    }
  } finally {
    processingFiles.delete(filePath)
  }
}

async function startWatcher() {
  log(`🚀 Voice Memory Auto-Uploader Started`, colors.bright)
  log(`👁️  Watching: ${WATCH_DIR}`, colors.blue)
  log(`📁 Processed files will be moved to: ${PROCESSED_DIR}`, colors.gray)
  log(`📏 Max file size: ${formatFileSize(MAX_FILE_SIZE)}`, colors.gray)
  log(`🎵 Supported formats: ${SUPPORTED_EXTENSIONS.join(', ')}`, colors.gray)
  
  // Ensure directories exist
  if (!fs.existsSync(WATCH_DIR)) {
    fs.mkdirSync(WATCH_DIR, { recursive: true })
    log(`Created watch directory: ${WATCH_DIR}`, colors.green)
  }
  await ensureProcessedDirectory()
  
  // Check authentication
  const isAuthenticated = await checkAuthentication()
  if (!isAuthenticated) {
    logError('Authentication required. Please configure your auth token.')
    process.exit(1)
  }
  
  // Set up file watcher
  const watcher = chokidar.watch(WATCH_DIR, {
    ignored: [
      /(^|[\/\\])\../, // Ignore dotfiles
      PROCESSED_DIR,   // Ignore processed directory
      /\.tmp$/,        // Ignore temp files
    ],
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  })
  
  // Handle file additions
  watcher.on('add', async (filePath) => {
    const relativePath = path.relative(WATCH_DIR, filePath)
    if (relativePath && !relativePath.startsWith('processed')) {
      log(`📥 New file detected: ${path.basename(filePath)}`, colors.blue)
      await processFile(filePath)
    }
  })
  
  // Handle errors
  watcher.on('error', (error) => {
    logError('Watcher error', error)
  })
  
  // Handle ready event
  watcher.on('ready', () => {
    log('✅ Ready! Drop audio files into the audio-exports folder...', colors.green)
  })
  
  // Handle process termination
  process.on('SIGINT', () => {
    log('\n👋 Shutting down auto-uploader...', colors.yellow)
    watcher.close()
    process.exit(0)
  })
}

// Start the watcher
startWatcher().catch((error) => {
  logError('Failed to start auto-uploader', error)
  process.exit(1)
})