import '@testing-library/jest-dom'

// Set up test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
process.env.OPENAI_API_KEY = 'test-openai-key'

// Mock isows module to avoid ES module issues
jest.mock('isows', () => ({
  WebSocket: global.WebSocket || class MockWebSocket {},
  default: global.WebSocket || class MockWebSocket {},
}))

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {
    return null
  }
  disconnect() {
    return null
  }
  unobserve() {
    return null
  }
}

// Mock fetch
global.fetch = jest.fn()

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {
    return null
  }
  disconnect() {
    return null
  }
  unobserve() {
    return null
  }
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock Request and Response for API route tests
if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init) {
      this.url = input
      this.method = init?.method || 'GET'
      this.headers = new Map(Object.entries(init?.headers || {}))
      this.body = init?.body
    }
    
    async formData() {
      return this.body
    }
    
    async json() {
      return JSON.parse(this.body)
    }
    
    async text() {
      return this.body
    }
  }
}

if (typeof Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body
      this.status = init?.status || 200
      this.statusText = init?.statusText || 'OK'
      this.headers = new Map(Object.entries(init?.headers || {}))
    }
    
    async json() {
      return JSON.parse(this.body)
    }
    
    async text() {
      return this.body
    }
  }
}

if (typeof FormData === 'undefined') {
  global.FormData = class FormData {
    constructor() {
      this.data = new Map()
    }
    
    append(key, value) {
      this.data.set(key, value)
    }
    
    get(key) {
      return this.data.get(key)
    }
    
    has(key) {
      return this.data.has(key)
    }
    
    entries() {
      return this.data.entries()
    }
  }
}

if (typeof File === 'undefined') {
  global.File = class File extends Blob {
    constructor(content, name, options) {
      super(content, options)
      this.name = name
      this.lastModified = Date.now()
    }
  }
}

if (typeof Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(content, options) {
      this.content = content
      this.type = options?.type || ''
      this.size = content.reduce((acc, curr) => acc + curr.length, 0)
    }
    
    async text() {
      return this.content.join('')
    }
    
    async arrayBuffer() {
      const text = await this.text()
      const buffer = new ArrayBuffer(text.length)
      const view = new Uint8Array(buffer)
      for (let i = 0; i < text.length; i++) {
        view[i] = text.charCodeAt(i)
      }
      return buffer
    }
  }
}