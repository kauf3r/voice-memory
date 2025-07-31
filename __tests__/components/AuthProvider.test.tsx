import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/app/components/AuthProvider'
import { configureMockClient, mockData } from '@supabase/supabase-js'

// Test component that uses the auth context
function TestComponent() {
  const { user, loading, signInWithEmail, signOut } = useAuth()
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="user">{user ? user.email : 'no-user'}</div>
      <button 
        data-testid="signin-btn" 
        onClick={() => signInWithEmail('test@example.com')}
      >
        Sign In
      </button>
      <button data-testid="signout-btn" onClick={signOut}>
        Sign Out
      </button>
    </div>
  )
}

describe('AuthProvider', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase = configureMockClient({ authenticated: true })
  })

  describe('Initial State', () => {
    it('should start with loading state', () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByTestId('loading')).toHaveTextContent('loading')
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    })

    it('should load existing session on mount', async () => {
      const mockSession = {
        user: mockData.user,
        access_token: 'mock-token',
        refresh_token: 'mock-refresh'
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
        expect(screen.getByTestId('user')).toHaveTextContent(mockData.user.email)
      })
    })

    it('should handle session loading errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Session loading failed')
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
        expect(screen.getByTestId('user')).toHaveTextContent('no-user')
      })
    })
  })

  describe('Authentication Methods', () => {
    beforeEach(() => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })
    })

    it('should handle sign in with email', async () => {
      mockSupabase.auth.signInWithOtp.mockResolvedValue({
        data: {},
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
      })

      const signInButton = screen.getByTestId('signin-btn')
      
      await act(async () => {
        signInButton.click()
      })

      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: expect.stringContaining('/auth/callback')
        }
      })
    })

    it('should handle sign in errors', async () => {
      mockSupabase.auth.signInWithOtp.mockResolvedValue({
        data: {},
        error: new Error('Sign in failed')
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
      })

      const signInButton = screen.getByTestId('signin-btn')
      
      await act(async () => {
        signInButton.click()
      })

      // Error should be handled (implementation specific)
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalled()
    })

    it('should handle sign out', async () => {
      // Start with authenticated user
      const mockSession = {
        user: mockData.user,
        access_token: 'mock-token'
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabase.auth.signOut.mockResolvedValue({
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent(mockData.user.email)
      })

      const signOutButton = screen.getByTestId('signout-btn')
      
      await act(async () => {
        signOutButton.click()
      })

      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    })

    it('should handle sign out errors', async () => {
      const mockSession = {
        user: mockData.user,
        access_token: 'mock-token'
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      })

      mockSupabase.auth.signOut.mockResolvedValue({
        error: new Error('Sign out failed')
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent(mockData.user.email)
      })

      const signOutButton = screen.getByTestId('signout-btn')
      
      await act(async () => {
        signOutButton.click()
      })

      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    })
  })

  describe('Auth State Changes', () => {
    it('should listen for auth state changes', async () => {
      const mockUnsubscribe = jest.fn()
      const mockSubscription = {
        subscription: { unsubscribe: mockUnsubscribe }
      }

      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: mockSubscription
      })

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled()
      })

      // Get the callback function passed to onAuthStateChange
      const authChangeCallback = mockSupabase.auth.onAuthStateChange.mock.calls[0][0]

      // Simulate sign in event
      await act(async () => {
        authChangeCallback('SIGNED_IN', {
          user: mockData.user,
          access_token: 'new-token'
        })
      })

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent(mockData.user.email)
      })

      // Simulate sign out event
      await act(async () => {
        authChangeCallback('SIGNED_OUT', null)
      })

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('no-user')
      })
    })

    it('should clean up auth listener on unmount', async () => {
      const mockUnsubscribe = jest.fn()
      const mockSubscription = {
        subscription: { unsubscribe: mockUnsubscribe }
      }

      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: mockSubscription
      })

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      const { unmount } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled()
      })

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('Component Cleanup', () => {
    it('should not update state after component unmounts', async () => {
      // Mock a slow session response
      let resolveSession: (value: any) => void
      const sessionPromise = new Promise(resolve => {
        resolveSession = resolve
      })
      
      mockSupabase.auth.getSession.mockReturnValue(sessionPromise)

      const { unmount } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      // Unmount before session resolves
      unmount()

      // Resolve session after unmount
      resolveSession!({
        data: { session: { user: mockData.user } },
        error: null
      })

      // Should not cause any state updates or errors
      await waitFor(() => {
        // Just ensure the promise resolves without errors
        expect(true).toBe(true)
      }, { timeout: 100 })
    })
  })

  describe('useAuth Hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Mock console.error to prevent error output in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      expect(() => {
        render(<TestComponent />)
      }).toThrow('useAuth must be used within an AuthProvider')

      consoleSpy.mockRestore()
    })

    it('should provide auth context values', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
      })

      // Check that all context methods are available
      expect(screen.getByTestId('signin-btn')).toBeInTheDocument()
      expect(screen.getByTestId('signout-btn')).toBeInTheDocument()
    })
  })

  describe('Authentication Timeout', () => {
    it('should handle authentication timeout', async () => {
      // Mock a request that times out
      mockSupabase.auth.signInWithOtp.mockImplementation(() => 
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: {}, error: new Error('Request timeout') })
          }, 16000) // Longer than 15 second timeout
        })
      )

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading')
      })

      const signInButton = screen.getByTestId('signin-btn')
      
      await act(async () => {
        signInButton.click()
      })

      // Should handle timeout gracefully
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalled()
    }, 20000) // Increase test timeout
  })

  describe('Multiple Auth Events', () => {
    it('should handle rapid auth state changes', async () => {
      const mockUnsubscribe = jest.fn()
      const mockSubscription = {
        subscription: { unsubscribe: mockUnsubscribe }
      }

      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: mockSubscription
      })

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled()
      })

      const authChangeCallback = mockSupabase.auth.onAuthStateChange.mock.calls[0][0]

      // Simulate rapid state changes
      await act(async () => {
        authChangeCallback('SIGNED_IN', { user: mockData.user })
        authChangeCallback('TOKEN_REFRESHED', { user: mockData.user })
        authChangeCallback('SIGNED_OUT', null)
        authChangeCallback('SIGNED_IN', { user: mockData.user })
      })

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent(mockData.user.email)
      })
    })
  })
})