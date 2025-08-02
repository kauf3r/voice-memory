'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../components/AuthProvider'
import { PinnedTasksProvider, usePinnedTasks } from '../components/PinnedTasksProvider'
import Layout from '../components/Layout'
import { supabase } from '@/lib/supabase'
import TaskSlideoutPanel from '../components/TaskSlideoutPanel'

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

type TabType = 'overview' | 'insights' | 'topics' | 'contacts' | 'timeline'

function KnowledgePageContent() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [knowledge, setKnowledge] = useState<KnowledgeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [showTaskPanel, setShowTaskPanel] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const { isPinned, pinTask, unpinTask } = usePinnedTasks()

  // Ensure component is mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Click handlers for interactive knowledge items
  const handleInsightClick = (insight: string, index: number) => {
    // For now, navigate to home page - could be enhanced to show specific note
    router.push('/')
  }

  const handleTopicClick = (topic: string) => {
    setSelectedTopic(topic)
    setActiveTab('topics')
  }

  const handleTaskClick = () => {
    setShowTaskPanel(true)
  }

  const handleContactClick = (contact: string) => {
    // Navigate to contacts tab with selected contact
    setActiveTab('contacts')
  }

  if (authLoading || !mounted) {
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
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Project Knowledge</h1>
            <p className="text-lg text-gray-600 mt-1">
              Aggregated insights from {stats?.totalNotes || 0} voice notes
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Last updated: Today
            </span>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Export
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search your knowledge base..."
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg className="absolute right-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'insights', label: 'Insights', icon: '💡' },
              { id: 'topics', label: 'Topics', icon: '🏷️' },
              { id: 'contacts', label: 'Contacts', icon: '👥' },
              { id: 'timeline', label: 'Timeline', icon: '📅' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`
                  flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="min-h-[500px]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                    <div className="text-3xl font-bold text-blue-600">{stats.totalNotes}</div>
                    <div className="text-sm text-gray-600 mt-1">Total Notes</div>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                    <div className="text-3xl font-bold text-green-600">{stats.totalInsights}</div>
                    <div className="text-sm text-gray-600 mt-1">Key Insights</div>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-gray-200 text-center cursor-pointer hover:bg-gray-50" onClick={handleTaskClick}>
                    <div className="text-3xl font-bold text-purple-600">{stats.totalTasks}</div>
                    <div className="text-sm text-gray-600 mt-1">Tasks</div>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                    <div className="text-3xl font-bold text-orange-600">{stats.totalMessages}</div>
                    <div className="text-sm text-gray-600 mt-1">Messages</div>
                  </div>
                  <div className="bg-white p-6 rounded-lg border border-gray-200 text-center">
                    <div className="text-3xl font-bold text-pink-600">{stats.totalOutreach}</div>
                    <div className="text-sm text-gray-600 mt-1">Outreach</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sentiment Distribution */}
                {stats && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Sentiment Distribution</h2>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">😊</span>
                        <span className="text-gray-700 mr-3">Positive</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-6">
                          <div 
                            className="bg-green-500 h-6 rounded-full"
                            style={{ width: `${stats.sentimentDistribution.positive}%` }}
                          />
                        </div>
                        <span className="ml-3 text-gray-600">{stats.sentimentDistribution.positive}%</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">😐</span>
                        <span className="text-gray-700 mr-3">Neutral</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-6">
                          <div 
                            className="bg-blue-500 h-6 rounded-full"
                            style={{ width: `${stats.sentimentDistribution.neutral}%` }}
                          />
                        </div>
                        <span className="ml-3 text-gray-600">{stats.sentimentDistribution.neutral}%</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">☹️</span>
                        <span className="text-gray-700 mr-3">Negative</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-6">
                          <div 
                            className="bg-red-500 h-6 rounded-full"
                            style={{ width: `${stats.sentimentDistribution.negative}%` }}
                          />
                        </div>
                        <span className="ml-3 text-gray-600">{stats.sentimentDistribution.negative}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Top Topics */}
                {topicEntries.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Top Topics</h2>
                    <div className="space-y-3">
                      {topicEntries.slice(0, 5).map(([topic, count], index) => (
                        <div 
                          key={index} 
                          className="flex justify-between items-center hover:bg-gray-50 cursor-pointer transition-colors rounded-lg p-2 -m-2"
                          onClick={() => handleTopicClick(topic)}
                        >
                          <span className="text-gray-700">{topic}</span>
                          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Knowledge Span */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Knowledge Span</h2>
                <div className="flex justify-between text-gray-600">
                  <span>From: First note</span>
                  <span>To: Latest note</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">All Insights</h2>
              <div className="space-y-3">
                {content?.recentInsights && content.recentInsights.length > 0 ? (
                  content.recentInsights.map((insight, index) => (
                    <div 
                      key={index} 
                      className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => handleInsightClick(insight, index)}
                    >
                      <p className="text-gray-700">{insight}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No insights available</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'topics' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {selectedTopic ? `Topic: ${selectedTopic}` : 'All Topics'}
              </h2>
              {selectedTopic && (
                <button
                  onClick={() => setSelectedTopic(null)}
                  className="mb-4 text-sm text-blue-600 hover:text-blue-800"
                >
                  ← Back to all topics
                </button>
              )}
              <div className="grid gap-3">
                {topicEntries.map(([topic, count], index) => (
                  <div 
                    key={index} 
                    className={`flex justify-between items-center hover:bg-gray-50 cursor-pointer transition-colors rounded-lg p-3 border ${
                      selectedTopic === topic ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => setSelectedTopic(topic === selectedTopic ? null : topic)}
                  >
                    <span className="text-gray-700 font-medium">{topic}</span>
                    <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                      {count} mentions
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Contacts</h2>
              <div className="space-y-3">
                {content?.keyContacts && Object.keys(content.keyContacts).length > 0 ? (
                  Object.entries(content.keyContacts).map(([contact, count], index) => (
                    <div 
                      key={index} 
                      className="flex justify-between items-center hover:bg-gray-50 cursor-pointer transition-colors rounded-lg p-3 border border-gray-200"
                      onClick={() => handleContactClick(contact)}
                    >
                      <span className="text-gray-700">{contact}</span>
                      <span className="text-sm text-gray-500">{count} mentions</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No contacts found</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Knowledge Timeline</h2>
              <div className="space-y-4">
                {content?.knowledgeTimeline && content.knowledgeTimeline.length > 0 ? (
                  content.knowledgeTimeline.map((item, index) => (
                    <div key={index} className="flex space-x-4 pb-4 border-b border-gray-100 last:border-0">
                      <div className="flex-shrink-0 w-24 text-sm text-gray-500">
                        {item.date}
                      </div>
                      <div className="flex-1">
                        <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded mb-2">
                          {item.type}
                        </span>
                        <p className="text-gray-700">{item.content}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No timeline data available</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Slide-out Panel */}
      <TaskSlideoutPanel
        isOpen={showTaskPanel}
        onClose={() => setShowTaskPanel(false)}
        initialTasks={content?.allTasks || []}
      />
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