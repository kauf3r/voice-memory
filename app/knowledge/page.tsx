'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../components/AuthProvider'
import { PinnedTasksProvider, usePinnedTasks } from '../components/PinnedTasksProvider'
import Layout from '../components/Layout'
import { supabase } from '@/lib/supabase'

interface KnowledgeData {
  topics: Array<{
    topic: string
    count: number
    notes: Array<{
      id: string
      title: string
      excerpt: string
    }>
  }>
  totalNotes: number
  totalTopics: number
}

function KnowledgePageContent() {
  const { user, loading: authLoading } = useAuth()
  const [knowledge, setKnowledge] = useState<KnowledgeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isPinned, pinTask, unpinTask } = usePinnedTasks()

  useEffect(() => {
    if (!user) return

    const fetchKnowledge = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get current session from Supabase client
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          throw new Error(`Session error: ${sessionError.message}`)
        }
        
        if (!session?.access_token) {
          throw new Error('No valid session or access token available')
        }

        console.log('🔐 Using session token for knowledge API:', {
          userId: session.user?.id,
          tokenLength: session.access_token.length,
          tokenStart: session.access_token.substring(0, 20) + '...'
        })

        const response = await fetch('/api/knowledge', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch knowledge: ${response.status}`)
        }

        const data = await response.json()
        setKnowledge(data)
      } catch (err) {
        console.error('Error fetching knowledge:', err)
        setError(err instanceof Error ? err.message : 'Failed to load knowledge')
      } finally {
        setLoading(false)
      }
    }

    fetchKnowledge()
  }, [user])

  if (authLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading...</span>
        </div>
      </Layout>
    )
  }

  if (!user) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">Please log in to view your knowledge base.</p>
        </div>
      </Layout>
    )
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading knowledge...</span>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error loading knowledge</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </Layout>
    )
  }

  if (!knowledge) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-600">No knowledge data available.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Knowledge Base</h1>
          <p className="text-lg text-gray-600">
            Insights from your {knowledge.totalNotes} voice notes across {knowledge.totalTopics} topics
          </p>
        </div>

        <div className="grid gap-6">
          {knowledge.topics.map((topic, index) => (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">{topic.topic}</h2>
                <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                  {topic.count} notes
                </span>
              </div>
              
              <div className="space-y-3">
                {topic.notes.map((note) => (
                  <div key={note.id} className="bg-gray-50 rounded-lg p-3">
                    <h3 className="font-medium text-gray-900 mb-1">{note.title}</h3>
                    <p className="text-gray-600 text-sm">{note.excerpt}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}

export default function KnowledgePage() {
  return (
    <PinnedTasksProvider>
      <KnowledgePageContent />
    </PinnedTasksProvider>
  )
}