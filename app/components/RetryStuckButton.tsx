'use client'

import { useState } from 'react'
import { useAuth } from '@/app/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { RetryRequest } from '@/lib/types'

interface RetryStuckButtonProps {
  onSuccess?: (result: any) => void
  onError?: (error: string) => void
}

export function RetryStuckButton({ onSuccess, onError }: RetryStuckButtonProps) {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const handleRetryStuck = async () => {
    try {
      setIsLoading(true)
      setLastResult(null)

      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const retryRequest: RetryRequest = {
        action: 'retryStuck',
        forceReset: true,
        batchSize: 10
      }

      const response = await fetch('/api/process/batch', {
        method: 'POST',
        headers,
        body: JSON.stringify(retryRequest)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Request failed: ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Retry operation failed')
      }

      const resetCount = result.reset || 0
      const processedCount = result.processed || 0
      const failedCount = result.failed || 0

      let resultMessage = `Reset ${resetCount} stuck note${resetCount !== 1 ? 's' : ''}`
      if (processedCount > 0) {
        resultMessage += `, processed ${processedCount} note${processedCount !== 1 ? 's' : ''}`
      }
      if (failedCount > 0) {
        resultMessage += `, ${failedCount} failed`
      }

      setLastResult(resultMessage)
      
      if (onSuccess) {
        onSuccess(result)
      }

      // Auto-clear success message after 5 seconds
      setTimeout(() => {
        setLastResult(null)
      }, 5000)

    } catch (error: any) {
      console.error('Failed to retry stuck notes:', error)
      const errorMessage = error.message || 'Failed to retry stuck notes'
      
      if (onError) {
        onError(errorMessage)
      } else {
        setLastResult(`Error: ${errorMessage}`)
        // Auto-clear error message after 8 seconds
        setTimeout(() => {
          setLastResult(null)
        }, 8000)
      }
    } finally {
      setIsLoading(false)
      setShowConfirmation(false)
    }
  }

  const handleConfirm = () => {
    setShowConfirmation(false)
    handleRetryStuck()
  }

  const handleCancel = () => {
    setShowConfirmation(false)
  }

  if (showConfirmation) {
    return (
      <div className="bg-white rounded-lg shadow p-4 border border-yellow-200">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 text-sm">⚠️</span>
            </div>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-gray-900">
              Retry Stuck Notes
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              This will reset any notes that are stuck in processing state and attempt to process them again. 
              This action is safe and won't affect completed notes.
            </p>
            <div className="mt-3 flex space-x-3">
              <button
                onClick={handleConfirm}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                Confirm Retry
              </button>
              <button
                onClick={handleCancel}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">Manual Recovery</h4>
        {lastResult && (
          <span className={`text-xs px-2 py-1 rounded ${
            lastResult.startsWith('Error:') 
              ? 'bg-red-100 text-red-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {lastResult}
          </span>
        )}
      </div>

      <button
        onClick={() => setShowConfirmation(true)}
        disabled={isLoading}
        className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Retrying Stuck Notes...
          </>
        ) : (
          <>
            🔄 Retry Stuck Notes
          </>
        )}
      </button>

      <p className="mt-2 text-xs text-gray-500">
        This will reset notes that are stuck in processing state and retry them automatically.
      </p>
    </div>
  )
}