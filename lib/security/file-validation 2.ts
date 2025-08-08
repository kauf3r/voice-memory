/**
 * Comprehensive File Upload Security Validation
 * 
 * Implements multiple layers of security for file uploads:
 * - MIME type validation
 * - File signature (magic bytes) validation  
 * - Content inspection
 * - Path traversal protection
 * - Size and rate limiting
 * - Malicious content detection
 */

import crypto from 'crypto'

// Node.js compatibility polyfills
const cryptoSubtle = typeof globalThis !== 'undefined' && globalThis.crypto?.subtle || crypto.webcrypto?.subtle
const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : 
  { encode: (str: string) => Buffer.from(str, 'utf8') }

// Security constants
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const MAX_FILENAME_LENGTH = 255
const ALLOWED_EXTENSIONS = ['mp3', 'm4a', 'wav', 'aac', 'ogg', 'webm', 'mp4', 'mov'] as const
const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'js', 'jar', 'wsf',
  'ps1', 'sh', 'php', 'asp', 'aspx', 'jsp', 'py', 'rb', 'pl', 'cgi',
  'dll', 'msi', 'deb', 'rpm', 'dmg', 'pkg', 'app', 'ipa', 'apk'
] as const

type AllowedExtension = typeof ALLOWED_EXTENSIONS[number]
type BlockedExtension = typeof BLOCKED_EXTENSIONS[number]

interface FileSignature {
  signature: number[]
  mimeType: string
  extension: string
  offset?: number
}

// File signatures for validation (magic bytes)
const FILE_SIGNATURES: FileSignature[] = [
  // Audio formats
  { signature: [0xFF, 0xFB], mimeType: 'audio/mpeg', extension: 'mp3' }, // MP3
  { signature: [0xFF, 0xF3], mimeType: 'audio/mpeg', extension: 'mp3' }, // MP3
  { signature: [0xFF, 0xF2], mimeType: 'audio/mpeg', extension: 'mp3' }, // MP3
  { signature: [0x49, 0x44, 0x33], mimeType: 'audio/mpeg', extension: 'mp3' }, // MP3 with ID3
  { signature: [0x52, 0x49, 0x46, 0x46], mimeType: 'audio/wav', extension: 'wav' }, // WAV
  { signature: [0xFF, 0xF1], mimeType: 'audio/aac', extension: 'aac' }, // AAC
  { signature: [0xFF, 0xF9], mimeType: 'audio/aac', extension: 'aac' }, // AAC
  { signature: [0x4F, 0x67, 0x67, 0x53], mimeType: 'audio/ogg', extension: 'ogg' }, // OGG
  
  // MP4/M4A container formats
  { signature: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], mimeType: 'audio/mp4', extension: 'm4a' }, // M4A
  { signature: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], mimeType: 'audio/mp4', extension: 'm4a' }, // M4A
  { signature: [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70], mimeType: 'video/mp4', extension: 'mp4' }, // MP4
  
  // Video formats (limited support)
  { signature: [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74], mimeType: 'video/quicktime', extension: 'mov' }, // MOV
  
  // WebM
  { signature: [0x1A, 0x45, 0xDF, 0xA3], mimeType: 'video/webm', extension: 'webm' }, // WebM
]

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  sanitizedFilename?: string
  detectedMimeType?: string
  detectedExtension?: string
  fileHash?: string
}

interface SecurityScanResult {
  safe: boolean
  threats: string[]
  risk: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Validate file upload security
 */
export async function validateFileUpload(file: File): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  }

  console.log('🔍 Starting file validation for:', file.name)
  console.log('📁 File details:', { 
    name: file.name, 
    type: file.type, 
    size: file.size,
    lastModified: new Date(file.lastModified).toISOString()
  })

  try {
    // Basic file validation
    if (!file) {
      console.log('❌ Validation failed: No file provided')
      result.errors.push('No file provided')
      result.valid = false
      return result
    }

    // File size validation
    if (file.size === 0) {
      result.errors.push('File is empty')
      result.valid = false
    }

    if (file.size > MAX_FILE_SIZE) {
      result.errors.push(`File size ${formatBytes(file.size)} exceeds maximum allowed size of ${formatBytes(MAX_FILE_SIZE)}`)
      result.valid = false
    }

    // Filename validation and sanitization
    const filenameValidation = validateAndSanitizeFilename(file.name)
    if (!filenameValidation.valid) {
      result.errors.push(...filenameValidation.errors)
      result.valid = false
    } else {
      result.sanitizedFilename = filenameValidation.sanitizedFilename
    }

    // Extension validation
    const extensionValidation = validateFileExtension(file.name)
    if (!extensionValidation.valid) {
      result.errors.push(...extensionValidation.errors)
      result.valid = false
    }

    // MIME type validation (client-declared)
    const mimeValidation = validateDeclaredMimeType(file.type)
    if (!mimeValidation.valid) {
      result.warnings.push(...mimeValidation.warnings)
    }

    // File signature validation (magic bytes)
    const signatureValidation = await validateFileSignature(file)
    if (!signatureValidation.valid) {
      result.errors.push(...signatureValidation.errors)
      result.valid = false
    } else {
      result.detectedMimeType = signatureValidation.detectedMimeType
      result.detectedExtension = signatureValidation.detectedExtension
    }

    // Content security scan
    const securityScan = await performSecurityScan(file)
    if (!securityScan.safe) {
      result.errors.push(`Security scan failed: ${securityScan.threats.join(', ')}`)
      result.valid = false
    }

    // Generate file hash for integrity
    result.fileHash = await generateFileHash(file)

  } catch (error) {
    result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    result.valid = false
  }

  return result
}

/**
 * Validate and sanitize filename
 */
function validateAndSanitizeFilename(filename: string): { valid: boolean; errors: string[]; sanitizedFilename?: string } {
  const errors: string[] = []

  if (!filename || filename.trim().length === 0) {
    errors.push('Filename cannot be empty')
    return { valid: false, errors }
  }

  if (filename.length > MAX_FILENAME_LENGTH) {
    errors.push(`Filename too long (max ${MAX_FILENAME_LENGTH} characters)`)
  }

  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    errors.push('Filename contains invalid path characters')
  }

  // Check for dangerous filename patterns
  const dangerousPatterns = [
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i, // Windows reserved names
    /^\./,  // Hidden files
    /\s+$/, // Trailing spaces
    /[<>:"|?*\x00-\x1f]/g // Invalid characters
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(filename)) {
      errors.push('Filename contains dangerous characters or patterns')
      break
    }
  }

  // Sanitize filename
  let sanitized = filename
    .replace(/[<>:"|?*\x00-\x1f]/g, '_') // Replace invalid chars
    .replace(/\s+/g, '_') // Replace spaces
    .replace(/_{2,}/g, '_') // Replace multiple underscores
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .toLowerCase()

  // Ensure filename isn't empty after sanitization
  if (sanitized.length === 0) {
    sanitized = 'file'
  }

  // Add timestamp to prevent conflicts
  const timestamp = Date.now()
  const extension = getFileExtension(filename)
  sanitized = `${timestamp}_${sanitized}.${extension}`

  return {
    valid: errors.length === 0,
    errors,
    sanitizedFilename: sanitized
  }
}

/**
 * Validate file extension
 */
function validateFileExtension(filename: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const extension = getFileExtension(filename).toLowerCase()

  if (!extension) {
    errors.push('File must have a valid extension')
    return { valid: false, errors }
  }

  // Check against blocked extensions
  if (BLOCKED_EXTENSIONS.includes(extension as BlockedExtension)) {
    errors.push(`File extension '${extension}' is not allowed for security reasons`)
  }

  // Check against allowed extensions
  if (!ALLOWED_EXTENSIONS.includes(extension as AllowedExtension)) {
    errors.push(`File extension '${extension}' is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Validate declared MIME type
 */
function validateDeclaredMimeType(mimeType: string): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []
  
  const allowedMimeTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4', 
    'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/webm',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]

  if (!allowedMimeTypes.includes(mimeType)) {
    warnings.push(`Declared MIME type '${mimeType}' is not in allowed list`)
  }

  return {
    valid: true, // Warnings only, as client MIME type can be unreliable
    warnings
  }
}

/**
 * Validate file signature (magic bytes)
 */
async function validateFileSignature(file: File): Promise<{ valid: boolean; errors: string[]; detectedMimeType?: string; detectedExtension?: string }> {
  const errors: string[] = []

  try {
    // Read first 32 bytes for signature detection
    const buffer = await file.slice(0, 32).arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Try to match known signatures
    let matchedSignature: FileSignature | null = null

    for (const sig of FILE_SIGNATURES) {
      const offset = sig.offset || 0
      if (bytes.length >= offset + sig.signature.length) {
        const match = sig.signature.every((byte, index) => 
          bytes[offset + index] === byte
        )
        
        if (match) {
          matchedSignature = sig
          break
        }
      }
    }

    if (!matchedSignature) {
      errors.push('File signature not recognized or file type not supported')
      return { valid: false, errors }
    }

    // Additional validation for MP4/M4A containers
    if (matchedSignature.mimeType.includes('mp4')) {
      const containerValidation = await validateMP4Container(file)
      if (!containerValidation.valid) {
        errors.push(...containerValidation.errors)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      detectedMimeType: matchedSignature.mimeType,
      detectedExtension: matchedSignature.extension
    }

  } catch (error) {
    errors.push(`Failed to read file signature: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return { valid: false, errors }
  }
}

/**
 * Validate MP4/M4A container
 */
async function validateMP4Container(file: File): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  try {
    // Read first 64 bytes to check ftyp box
    const buffer = await file.slice(0, 64).arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Look for ftyp box
    let ftypFound = false
    for (let i = 0; i < bytes.length - 8; i++) {
      if (bytes[i] === 0x66 && bytes[i + 1] === 0x74 && 
          bytes[i + 2] === 0x79 && bytes[i + 3] === 0x70) {
        ftypFound = true
        
        // Check brand compatibility
        const brand = String.fromCharCode.apply(null, Array.from(bytes.slice(i + 4, i + 8)))
        const validBrands = ['M4A ', 'M4B ', 'mp41', 'mp42', 'isom', 'avc1', 'MSNV', 'qt  ']
        
        if (!validBrands.includes(brand)) {
          errors.push(`Unsupported MP4 brand: ${brand}`)
        }
        break
      }
    }

    if (!ftypFound) {
      errors.push('Invalid MP4/M4A container: missing ftyp box')
    }

  } catch (error) {
    errors.push(`MP4 container validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Perform security scan on file content
 */
async function performSecurityScan(file: File): Promise<SecurityScanResult> {
  const threats: string[] = []
  let risk: SecurityScanResult['risk'] = 'low'

  try {
    // Read a sample of the file for scanning
    const sampleSize = Math.min(file.size, 1024 * 1024) // 1MB sample
    const buffer = await file.slice(0, sampleSize).arrayBuffer()
    const bytes = new Uint8Array(buffer)

    // Check for embedded executables
    const executableSignatures = [
      [0x4D, 0x5A], // PE executables (Windows)
      [0x7F, 0x45, 0x4C, 0x46], // ELF executables (Linux)
      [0xFE, 0xED, 0xFA, 0xCE], // Mach-O executables (macOS)
      [0xFE, 0xED, 0xFA, 0xCF], // Mach-O 64-bit
      [0xCA, 0xFE, 0xBA, 0xBE], // Java bytecode
    ]

    for (const signature of executableSignatures) {
      if (findSignatureInBytes(bytes, signature)) {
        threats.push('Embedded executable detected')
        risk = 'critical'
        break
      }
    }

    // Check for script content
    const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) :
      { decode: (bytes: Uint8Array) => Buffer.from(bytes).toString('utf8') }
    const textContent = textDecoder.decode(bytes.slice(0, 1024))
    const scriptPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i, // Event handlers
      /eval\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
    ]

    for (const pattern of scriptPatterns) {
      if (pattern.test(textContent)) {
        threats.push('Script content detected')
        risk = risk === 'critical' ? 'critical' : 'high'
        break
      }
    }

    // Check file size ratio (compressed content detection)
    const compressionRatio = file.size / sampleSize
    if (compressionRatio > 1000) {
      threats.push('Suspicious compression ratio')
      risk = risk === 'critical' ? 'critical' : 'medium'
    }

  } catch (error) {
    threats.push(`Security scan error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    risk = 'medium'
  }

  return {
    safe: threats.length === 0,
    threats,
    risk
  }
}

/**
 * Generate file hash for integrity checking
 */
async function generateFileHash(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer()
    
    if (cryptoSubtle) {
      const hashBuffer = await cryptoSubtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } else {
      // Fallback to Node.js crypto
      const hash = crypto.createHash('sha256')
      hash.update(Buffer.from(buffer))
      return hash.digest('hex')
    }
  } catch (error) {
    // Fallback hash generation
    return crypto.createHash('sha256').update(Buffer.from('fallback')).digest('hex')
  }
}

/**
 * Utility functions
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop()! : ''
}

function findSignatureInBytes(bytes: Uint8Array, signature: number[]): boolean {
  for (let i = 0; i <= bytes.length - signature.length; i++) {
    if (signature.every((byte, index) => bytes[i + index] === byte)) {
      return true
    }
  }
  return false
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Rate limiting for file uploads
 */
interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  error?: string
}

const uploadAttempts = new Map<string, { count: number; resetTime: number }>()

export function checkUploadRateLimit(userId: string, maxUploads = 10, windowMs = 60000): RateLimitResult {
  const now = Date.now()
  const userAttempts = uploadAttempts.get(userId)

  if (!userAttempts || now > userAttempts.resetTime) {
    // Reset or initialize
    uploadAttempts.set(userId, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxUploads - 1, resetTime: now + windowMs }
  }

  if (userAttempts.count >= maxUploads) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: userAttempts.resetTime,
      error: `Rate limit exceeded. Try again in ${Math.ceil((userAttempts.resetTime - now) / 1000)} seconds`
    }
  }

  userAttempts.count++
  uploadAttempts.set(userId, userAttempts)

  return {
    allowed: true,
    remaining: maxUploads - userAttempts.count,
    resetTime: userAttempts.resetTime
  }
}