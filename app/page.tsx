'use client'

import { useAuth } from './components/AuthProvider'
import Layout, { GridContainer, GridItem } from './components/Layout'
import { LoadingPage } from './components/LoadingSpinner'
import LoginForm from './components/LoginForm'

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingPage />
  }

  if (!user) {
    return <LoginForm />
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Voice Memory</h1>
          <p className="text-lg text-gray-600">Transform your voice notes into actionable insights</p>
        </div>

        {/* Quick Actions */}
        <div className="flex justify-center">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">
            Upload Voice Note
          </button>
        </div>

        {/* Stats Grid */}
        <GridContainer>
          <GridItem className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Total Notes</h3>
            <p className="text-3xl font-bold text-blue-600">0</p>
            <p className="text-sm text-gray-500">No notes yet</p>
          </GridItem>
          
          <GridItem className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Processing</h3>
            <p className="text-3xl font-bold text-orange-600">0</p>
            <p className="text-sm text-gray-500">In queue</p>
          </GridItem>
          
          <GridItem className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Insights</h3>
            <p className="text-3xl font-bold text-green-600">0</p>
            <p className="text-sm text-gray-500">Generated</p>
          </GridItem>
        </GridContainer>

        {/* Recent Notes */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Notes</h2>
          <div className="text-center py-12 text-gray-500">
            <p>No voice notes yet. Upload your first recording to get started!</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}