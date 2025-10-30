/**
 * Authentication Flow Tests
 * Tests for race condition prevention, session management, and token refresh cycles
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { AuthProvider, useAuth } from '@/app/components/AuthProvider'
import { supabase } from '@/lib/supabase'

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithOtp: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
    }
  }
}))

// Test component to access auth context
function TestComponent() {
  const { user, loading, signInWithEmail, signOut } = useAuth()
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="user">{user?.email || 'No User'}</div>
      <button 
        data-testid="signin" 
        onClick={() => signInWithEmail('test@example.com')}
      >
        Sign In
      </button>
      <button data-testid="signout" onClick={signOut}>
        Sign Out
      </button>
    </div>
  )
}

describe('Authentication Flow Tests', () => {
  const mockSupabase = supabase as jest.Mocked<typeof supabase>
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock implementations
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    })
    
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } }
    } as any)
  })

  describe('Race Condition Prevention', () => {
    test('handles concurrent auth state changes without race conditions', async () => {
      const mockSession = {
        user: { id: '123', email: 'test@example.com' },
        access_token: 'mock-token'
      }
      
      // Mock rapid auth state changes
      let authChangeCallback: (event: string, session: any) => void
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback
        return { data: { subscription: { unsubscribe: jest.fn() } } } as any
      })
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
      
      // Simulate rapid auth state changes (race condition scenario)
      act(() => {
        authChangeCallback('SIGNED_IN', mockSession)
        authChangeCallback('TOKEN_REFRESHED', mockSession)
        authChangeCallback('SIGNED_OUT', null)
        authChangeCallback('SIGNED_IN', mockSession)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      })
      
      // Should show final auth state without flickering
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })

    test('prevents duplicate sign-in attempts', async () => {
      mockSupabase.auth.signInWithOtp.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
      
      const signInButton = screen.getByTestId('signin')
      
      // Rapid clicks should not trigger multiple API calls
      await userEvent.click(signInButton)
      await userEvent.click(signInButton)
      await userEvent.click(signInButton)
      
      await waitFor(() => {
        expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Session Management', () => {
    test('initializes with existing session', async () => {
      const mockSession = {
        user: { id: '123', email: 'existing@example.com' },
        access_token: 'existing-token'
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
        expect(screen.getByTestId('user')).toHaveTextContent('existing@example.com')
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
    })

    test('handles session initialization errors gracefully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session error' }
      })
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('No User')
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
      })
    })

    test('manages auth state transitions correctly', async () => {
      let authChangeCallback: (event: string, session: any) => void
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback
        return { data: { subscription: { unsubscribe: jest.fn() } } } as any
      })
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
      
      // Initial state - no user
      expect(screen.getByTestId('user')).toHaveTextContent('No User')
      
      // Sign in
      const mockSession = {
        user: { id: '123', email: 'test@example.com' },
        access_token: 'token'
      }
      
      act(() => {
        authChangeCallback('SIGNED_IN', mockSession)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      })
      
      // Sign out
      act(() => {
        authChangeCallback('SIGNED_OUT', null)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('No User')
      })
    })
  })

  describe('Token Refresh Cycle', () => {
    test('handles token refresh events', async () => {
      const originalSession = {
        user: { id: '123', email: 'test@example.com' },
        access_token: 'original-token'
      }
      
      const refreshedSession = {
        user: { id: '123', email: 'test@example.com' },
        access_token: 'refreshed-token'
      }
      
      let authChangeCallback: (event: string, session: any) => void
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback
        return { data: { subscription: { unsubscribe: jest.fn() } } } as any
      })
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
      
      // Initial sign in
      act(() => {
        authChangeCallback('SIGNED_IN', originalSession)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      })
      
      // Token refresh
      act(() => {
        authChangeCallback('TOKEN_REFRESHED', refreshedSession)
      })
      
      // User should remain signed in
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })

    test('handles token refresh failures', async () => {
      let authChangeCallback: (event: string, session: any) => void
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback
        return { data: { subscription: { unsubscribe: jest.fn() } } } as any
      })
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
      
      // Initial sign in
      const mockSession = {
        user: { id: '123', email: 'test@example.com' },
        access_token: 'token'
      }
      
      act(() => {
        authChangeCallback('SIGNED_IN', mockSession)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      })
      
      // Token refresh failure (sign out event)
      act(() => {
        authChangeCallback('SIGNED_OUT', null)
      })
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('No User')
      })
    })
  })

  describe('Error Handling', () => {
    test('handles sign-in errors gracefully', async () => {
      mockSupabase.auth.signInWithOtp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid email' }
      })
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
      
      const signInButton = screen.getByTestId('signin')
      
      await userEvent.click(signInButton)
      
      // Should not crash and maintain stable state
      expect(screen.getByTestId('user')).toHaveTextContent('No User')
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })

    test('handles sign-out errors gracefully', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: { message: 'Sign out failed' }
      })
      
      // Start with signed in user
      const mockSession = {
        user: { id: '123', email: 'test@example.com' },
        access_token: 'token'
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
        expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
      })
      
      const signOutButton = screen.getByTestId('signout')
      await userEvent.click(signOutButton)
      
      // Should handle error gracefully without crashing
      expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    })
  })

  describe('Cleanup', () => {
    test('properly unsubscribes from auth changes on unmount', () => {
      const mockUnsubscribe = jest.fn()
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } }
      } as any)
      
      const { unmount } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )
      
      unmount()
      
      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })
})