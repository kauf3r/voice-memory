'use client'

import { useState } from 'react'
import { useAuth } from './AuthProvider'

interface BetaOnboardingProps {
  onComplete: () => void
  isVisible: boolean
}

const steps = [
  {
    title: 'Welcome to Voice Memory',
    content: (
      <div className="text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Transform Voice Notes into Actionable Insights
        </h2>
        <p className="text-gray-600 mb-6">
          Voice Memory uses AI to transcribe your voice notes and extract meaningful insights, 
          tasks, and next steps automatically.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 text-sm">
            🎉 You're one of our beta users! Your feedback helps us improve the product.
          </p>
        </div>
      </div>
    )
  },
  {
    title: 'How It Works',
    content: (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Simple 3-Step Process</h2>
        <div className="space-y-6">
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              1
            </div>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900">Record or Upload</h3>
              <p className="text-gray-600">Upload audio files or record directly in your browser</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              2
            </div>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900">AI Processing</h3>
              <p className="text-gray-600">Our AI transcribes and analyzes your audio for insights</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              3
            </div>
            <div className="ml-4">
              <h3 className="font-semibold text-gray-900">Get Results</h3>
              <p className="text-gray-600">View transcriptions, extracted tasks, and actionable insights</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    title: 'Key Features',
    content: (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">What Voice Memory Can Do</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-semibold">Accurate Transcription</h3>
            </div>
            <p className="text-gray-600 text-sm">Convert speech to text with high accuracy</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="font-semibold">Task Extraction</h3>
            </div>
            <p className="text-gray-600 text-sm">Automatically identify tasks and action items</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="font-semibold">Key Insights</h3>
            </div>
            <p className="text-gray-600 text-sm">Extract important themes and insights</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-orange-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="font-semibold">Knowledge Base</h3>
            </div>
            <p className="text-gray-600 text-sm">Build searchable knowledge from your notes</p>
          </div>
        </div>
      </div>
    )
  },
  {
    title: 'Beta Feedback',
    content: (
      <div className="text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Help Us Improve</h2>
        <p className="text-gray-600 mb-6">
          As a beta user, your feedback is invaluable. We're actively improving the product 
          based on user experiences and suggestions.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="font-semibold text-amber-800 mb-2">How to Provide Feedback</h3>
          <ul className="text-amber-700 text-sm text-left space-y-1">
            <li>• Use the feedback button in the app</li>
            <li>• Report any bugs or issues you encounter</li>
            <li>• Suggest features you'd like to see</li>
            <li>• Share how you're using Voice Memory</li>
          </ul>
        </div>
      </div>
    )
  }
]

export default function BetaOnboarding({ onComplete, isVisible }: BetaOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const { user } = useAuth()

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Mark onboarding as complete
      localStorage.setItem('voice-memory-onboarding-complete', 'true')
      onComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('voice-memory-onboarding-complete', 'true')
    onComplete()
  }

  if (!isVisible) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm text-gray-500">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              Skip
            </button>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          {steps[currentStep].content}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              {currentStep === steps.length - 1 ? "Get Started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}