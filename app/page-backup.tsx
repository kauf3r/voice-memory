'use client'

import { useAuth } from './components/AuthProvider'
import Layout from './components/Layout'
import { LoadingPage } from './components/LoadingSpinner'
import LoginForm from './components/LoginForm'
import AutoAuth from './components/AutoAuth'

export default function Home() {
  const { user, loading: authLoading } = useAuth()

  if (authLoading) {
    return <LoadingPage />
  }

  if (!user) {
    return (
      <Layout>
        <div className="space-y-6">
          <AutoAuth />
          <LoginForm />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Voice Memory</h1>
          <p className="text-lg text-gray-600">Transform your voice notes into actionable insights</p>
        </div>
        
        <div className="text-center">
          <p>Basic page loaded successfully!</p>
        </div>
      </div>
    </Layout>
  )
}