'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '../components/AuthProvider'
import { PinnedTasksProvider, usePinnedTasks } from '../components/PinnedTasksProvider'
import Layout from '../components/Layout'
import { supabase } from '@/lib/supabase'

interface KnowledgeData {
  knowledge: {
    stats: {
      totalNotes: number
      totalInsights: number
      totalTasks: number
      totalMessages: number
      totalOutreach: number
      sentimentDistribution: {
        positive: number
        neutral: number
        negative: number
      }
    }
    content: {
      recentInsights: string[]
      topTopics: Record<string, number>
      keyContacts: Record<string, number>
      commonTasks: Record<string, number>
      allTasks: Array<{
        id: string
        description: string
        type: string
        date: string
        noteId: string
        completed: boolean
      }>
      sentimentTrends: Array<{date: string, sentiment: string}>
      knowledgeTimeline: Array<{
        date: string
        type: string
        content: string
        noteId: string
      }>
    }
  }
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

  const stats = knowledge?.knowledge?.stats
  const content = knowledge?.knowledge?.content
  const topTopics = content?.topTopics || {}
  const topicEntries = Object.entries(topTopics).sort(([,a], [,b]) => b - a)
  
  return (
    <Layout>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Knowledge Base</h1>
          <p className="text-lg text-gray-600">
            {stats ? `Insights from your ${stats.totalNotes} voice notes with ${stats.totalInsights} key insights` : 'Loading insights...'}
          </p>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{stats.totalNotes}</div>
              <div className="text-sm text-gray-600">Total Notes</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{stats.totalInsights}</div>
              <div className="text-sm text-gray-600">Key Insights</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{stats.totalTasks}</div>
              <div className="text-sm text-gray-600">Tasks Created</div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="text-2xl font-bold text-gray-900">{topicEntries.length}</div>
              <div className="text-sm text-gray-600">Topics</div>
            </div>
          </div>
        )}

        {/* Recent Insights */}
        {content?.recentInsights && content.recentInsights.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Insights</h2>
            <div className="space-y-3">
              {content.recentInsights.slice(0, 10).map((insight, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-700">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Topics */}
        {topicEntries.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Topics</h2>
            <div className="grid gap-3">
              {topicEntries.slice(0, 10).map(([topic, count], index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-700">{topic}</span>
                  <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                    {count} mentions
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Tasks */}
        {content?.allTasks && content.allTasks.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Tasks</h2>
            <div className="space-y-3">
              {content.allTasks.slice(0, 10).map((task) => (
                <div key={task.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <p className="text-gray-700 flex-1">{task.description}</p>
                    {task.completed && (
                      <span className="ml-2 text-green-600 text-sm">✓ Completed</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(task.date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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