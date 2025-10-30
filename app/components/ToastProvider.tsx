'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import Toast from './Toast'

interface ToastData {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
  duration?: number
}

interface ToastContextType {
  showToast: (message: string, type: 'success' | 'error' | 'info', duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    // During build/SSR, return a no-op function instead of throwing
    if (typeof window === 'undefined') {
      return {
        showToast: () => {} // No-op for server-side rendering
      }
    }
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const counterRef = useRef(0)

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info', duration = 3000) => {
    const id = `toast-${++counterRef.current}` // Use counter instead of Date.now() for consistency
    const newToast: ToastData = { id, message, type, duration }
    
    setToasts(prev => [...prev, newToast])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Render toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className="pointer-events-auto"
            style={{ transform: `translateY(${index * 4}px)` }}
          >
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
              duration={toast.duration}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}