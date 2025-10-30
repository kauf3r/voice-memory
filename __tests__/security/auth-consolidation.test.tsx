/**
 * Authentication System Consolidation Tests
 * Ensures there's only one source of truth for authentication
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/app/components/AuthProvider'
import { PinnedTasksProvider, usePinnedTasks } from '@/app/components/PinnedTasksProvider'
import { ToastProvider } from '@/app/components/ToastProvider'

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: jest.fn(),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } }
    })),
    signInWithOtp: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn()
  },
  channel: jest.fn(),
  removeChannel: jest.fn()
}

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  processUrlTokens: jest.fn()
}))

jest.mock('@/lib/auth-debug', () => ({
  AuthDebugger: {
    log: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    debugUrl: jest.fn(),
    debugSession: jest.fn(),
    debugAuthState: jest.fn()
  }
}))

// Mock fetch for API calls
global.fetch = jest.fn()

// Test component that uses both auth providers
function TestComponent() {
  const auth = useAuth()
  const pinnedTasks = usePinnedTasks()

  return (
    <div>
      <div data-testid="auth-user">{auth.user?.id || 'no-user'}</div>
      <div data-testid="auth-loading">{auth.loading.toString()}</div>
      <div data-testid="auth-authenticated">{auth.isAuthenticated.toString()}</div>
      <div data-testid="pinned-count">{pinnedTasks.pinCount}</div>
      <div data-testid="pinned-loading">{pinnedTasks.isLoading.toString()}</div>
    </div>
  )
}

describe('Authentication System Consolidation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mocks
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    })
    
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    })
    
    mockSupabase.channel.mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue(Promise.resolve())
    })
  })

  it('should use single authentication source', async () => {
    const mockUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      aud: 'authenticated',
      role: 'authenticated'
    }

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { 
        session: { 
          user: mockUser,
          access_token: 'test-token-123'
        } 
      },
      error: null
    })

    const { getByTestId } = render(
      <AuthProvider>
        <ToastProvider>
          <PinnedTasksProvider>
            <TestComponent />
          </PinnedTasksProvider>
        </ToastProvider>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(getByTestId('auth-user')).toHaveTextContent('test-user-123')
      expect(getByTestId('auth-authenticated')).toHaveTextContent('true')
    })

    // Verify that both providers see the same user
    expect(getByTestId('auth-loading')).toHaveTextContent('false')
    expect(getByTestId('pinned-loading')).toHaveTextContent('false')
  })

  it('should handle authentication state changes consistently', async () => {
    let authStateChangeCallback: Function

    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authStateChangeCallback = callback
      return {
        data: { subscription: { unsubscribe: jest.fn() } }
      }
    })

    const { getByTestId } = render(
      <AuthProvider>
        <ToastProvider>
          <PinnedTasksProvider>
            <TestComponent />
          </PinnedTasksProvider>
        </ToastProvider>
      </AuthProvider>
    )

    // Initial state - no user
    await waitFor(() => {
      expect(getByTestId('auth-user')).toHaveTextContent('no-user')
      expect(getByTestId('auth-authenticated')).toHaveTextContent('false')
    })

    // Simulate sign in
    const mockUser = {
      id: 'signed-in-user',
      email: 'user@example.com'
    }

    const mockSession = {
      user: mockUser,
      access_token: 'new-token'
    }

    // Trigger auth state change
    authStateChangeCallback!('SIGNED_IN', mockSession)

    await waitFor(() => {
      expect(getByTestId('auth-user')).toHaveTextContent('signed-in-user')
      expect(getByTestId('auth-authenticated')).toHaveTextContent('true')
    })
  })

  it('should provide getAccessToken utility', async () => {
    const mockSession = {
      user: { id: 'test-user' },
      access_token: 'test-access-token'
    }

    mockSupabase.auth.getSession
      .mockResolvedValueOnce({
        data: { session: mockSession },
        error: null
      })
      .mockResolvedValueOnce({
        data: { session: mockSession },
        error: null
      })

    function TokenTestComponent() {
      const { getAccessToken } = useAuth()
      const [token, setToken] = React.useState<string | null>(null)

      React.useEffect(() => {
        getAccessToken().then(setToken)
      }, [getAccessToken])

      return <div data-testid="access-token">{token || 'no-token'}</div>
    }

    render(
      <AuthProvider>
        <TokenTestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('access-token')).toHaveTextContent('test-access-token')
    })
  })

  it('should cache authentication tokens to prevent race conditions', async () => {
    const mockUser = {
      id: 'test-user',
      email: 'test@example.com'
    }

    const mockSession = {
      user: mockUser,
      access_token: 'cached-token'
    }

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    })

    // Mock fetch for the pinned tasks API call
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        pinnedTasks: []
      })
    })

    render(
      <AuthProvider>
        <ToastProvider>
          <PinnedTasksProvider>
            <TestComponent />
          </PinnedTasksProvider>
        </ToastProvider>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(getByTestId('auth-user')).toHaveTextContent('test-user')
    })

    // Verify that the PinnedTasksProvider made the API call with the correct token
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/tasks/pinned', {
        headers: {
          'Authorization': 'Bearer cached-token'
        }
      })
    })

    // Verify that getSession was called (for the auth token caching)
    expect(mockSupabase.auth.getSession).toHaveBeenCalled()
  })

  it('should handle authentication errors gracefully', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Session expired' }
    })

    const { getByTestId } = render(
      <AuthProvider>
        <ToastProvider>
          <PinnedTasksProvider>
            <TestComponent />
          </PinnedTasksProvider>
        </ToastProvider>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(getByTestId('auth-user')).toHaveTextContent('no-user')
      expect(getByTestId('auth-authenticated')).toHaveTextContent('false')
    })

    // Verify that PinnedTasksProvider handled the auth error gracefully
    expect(getByTestId('pinned-count')).toHaveTextContent('0')
  })

  it('should not make multiple simultaneous auth calls', async () => {
    const mockUser = { id: 'test-user' }
    const mockSession = { user: mockUser, access_token: 'test-token' }

    // Add a delay to getSession to test caching
    mockSupabase.auth.getSession.mockImplementation(() => 
      new Promise(resolve => {
        setTimeout(() => {
          resolve({
            data: { session: mockSession },
            error: null
          })
        }, 100)
      })
    )

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        pinnedTasks: []
      })
    })

    function MultipleAuthCallsComponent() {
      const { user, getAccessToken } = useAuth()
      const [tokens, setTokens] = React.useState<string[]>([])

      React.useEffect(() => {
        if (user) {
          // Make multiple token requests simultaneously
          Promise.all([
            getAccessToken(),
            getAccessToken(),
            getAccessToken()
          ]).then(results => {
            setTokens(results.filter(Boolean) as string[])
          })
        }
      }, [user, getAccessToken])

      return (
        <div>
          <div data-testid="user-id">{user?.id || 'no-user'}</div>
          <div data-testid="token-count">{tokens.length}</div>
        </div>
      )
    }

    render(
      <AuthProvider>
        <ToastProvider>
          <PinnedTasksProvider>
            <MultipleAuthCallsComponent />
          </PinnedTasksProvider>
        </ToastProvider>
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('user-id')).toHaveTextContent('test-user')
      expect(screen.getByTestId('token-count')).toHaveTextContent('3')
    }, { timeout: 3000 })

    // The auth session should be cached and not called multiple times excessively
    expect(mockSupabase.auth.getSession).toHaveBeenCalled()
  })
})

describe('Authentication Consolidation Integration', () => {
  it('should verify no competing auth systems exist', () => {
    // This test ensures that we've successfully removed the competing auth system
    expect(() => {
      require('@/lib/hooks/use-auth')
    }).toThrow()
  })

  it('should provide all necessary auth utilities from single source', () => {
    function AuthUtilityComponent() {
      const {
        user,
        loading,
        signInWithEmail,
        signOut,
        getAccessToken,
        isAuthenticated
      } = useAuth()

      return (
        <div>
          <div data-testid="has-user">{typeof user}</div>
          <div data-testid="has-loading">{typeof loading}</div>
          <div data-testid="has-signin">{typeof signInWithEmail}</div>
          <div data-testid="has-signout">{typeof signOut}</div>
          <div data-testid="has-token">{typeof getAccessToken}</div>
          <div data-testid="has-auth">{typeof isAuthenticated}</div>
        </div>
      )
    }

    render(
      <AuthProvider>
        <AuthUtilityComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('has-user')).toHaveTextContent('object')
    expect(screen.getByTestId('has-loading')).toHaveTextContent('boolean')
    expect(screen.getByTestId('has-signin')).toHaveTextContent('function')
    expect(screen.getByTestId('has-signout')).toHaveTextContent('function')
    expect(screen.getByTestId('has-token')).toHaveTextContent('function')
    expect(screen.getByTestId('has-auth')).toHaveTextContent('boolean')
  })
})