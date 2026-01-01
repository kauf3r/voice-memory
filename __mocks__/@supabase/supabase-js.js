// Mock for @supabase/supabase-js to avoid ES module issues in tests

// Mock user for authenticated states
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
}

// Mock session for authenticated states  
const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  token_type: 'bearer',
  user: mockUser,
}

// Create a configurable mock client
const createMockSupabaseClient = (options = {}) => {
  const isAuthenticated = options.authenticated !== false
  
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({ 
        data: { user: isAuthenticated ? mockUser : null }, 
        error: null 
      }),
      getSession: jest.fn().mockResolvedValue({ 
        data: { session: isAuthenticated ? mockSession : null }, 
        error: null 
      }),
      signInWithOtp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
    from: jest.fn((table) => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lt: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        then: jest.fn().mockResolvedValue({ data: [], error: null }),
      }
      return mockQueryBuilder
    }),
    storage: {
      from: jest.fn((bucket) => ({
        upload: jest.fn().mockResolvedValue({ 
          data: { path: 'test-path', id: 'test-id', fullPath: `${bucket}/test-path` }, 
          error: null 
        }),
        download: jest.fn().mockResolvedValue({ 
          data: new Blob(['test content'], { type: 'audio/mp3' }), 
          error: null 
        }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ 
          data: { publicUrl: `https://test-bucket.supabase.co/storage/v1/object/public/${bucket}/test-path` } 
        }),
        createSignedUrl: jest.fn().mockResolvedValue({ 
          data: { signedUrl: `https://test-bucket.supabase.co/storage/v1/object/sign/${bucket}/test-path` }, 
          error: null 
        }),
      })),
    },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    })),
    removeChannel: jest.fn(),
    removeAllChannels: jest.fn(),
    getChannels: jest.fn().mockReturnValue([]),
  }
}

// Default mock client
const mockSupabaseClient = createMockSupabaseClient()

// Export the create client function
export const createClient = jest.fn(() => mockSupabaseClient)

// Export helper to configure mock for different test scenarios
export const configureMockClient = (options) => {
  const newClient = createMockSupabaseClient(options)
  createClient.mockReturnValue(newClient)
  return newClient
}

// Export mock data for use in tests
export const mockData = {
  user: mockUser,
  session: mockSession,
}

export default {
  createClient,
  configureMockClient,
  mockData,
}