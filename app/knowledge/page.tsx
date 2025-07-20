'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../components/AuthProvider'
import Layout, { GridContainer, GridItem } from '../components/Layout'
import { LoadingPage } from '../components/LoadingSpinner'
import LoginForm from '../components/LoginForm'
import ErrorMessage from '../components/ErrorMessage'
import SearchBar from '../components/SearchBar'
import ExportButton from '../components/ExportButton'
import FilteredNotes from '../components/FilteredNotes'
import { supabase } from '@/lib/supabase'

interface KnowledgeStats {
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
  timeRange: {
    earliest: string | null
    latest: string | null
  }
}

interface KnowledgeContent {
  recentInsights: string[]
  topTopics: Record<string, number>
  keyContacts: Record<string, number>
  commonTasks: Record<string, number>
  sentimentTrends: Array<{date: string, sentiment: string}>
  knowledgeTimeline: Array<{
    date: string
    type: string
    content: string
    noteId: string
  }>
}

interface KnowledgeData {
  stats: KnowledgeStats
  content: KnowledgeContent
  projectKnowledge: Record<string, any>
  lastUpdated: string
  generatedAt: string
}

export default function KnowledgePage() {
  const { user, loading: authLoading } = useAuth()
  const [knowledge, setKnowledge] = useState<KnowledgeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [filter, setFilter] = useState<{
    type: 'topic' | 'contact' | 'sentiment' | 'date'
    value: string
  } | null>(null)

  const fetchKnowledge = async () => {
    if (!user) return

    try {
      setError(null)
      
      // Get the current session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session. Please log in again.')
      }

      const response = await fetch('/api/knowledge', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch knowledge data')
      }

      const data = await response.json()
      setKnowledge(data.knowledge)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'json' | 'csv' | 'pdf') => {
    if (!user) return

    try {
      // Get the current session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session. Please log in again.')
      }

      const response = await fetch(`/api/knowledge/export?format=${format}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Create download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      // Extract filename from response headers or create default
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `voice-memory-knowledge-${new Date().toISOString().split('T')[0]}.${format}`
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Please try again.')
    }
  }

  useEffect(() => {
    fetchKnowledge()
  }, [user])

  if (authLoading) {
    return <LoadingPage />
  }

  if (!user) {
    return <LoginForm />
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading knowledge base...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <ErrorMessage
          title="Failed to load knowledge"
          message={error}
          onRetry={fetchKnowledge}
        />
      </Layout>
    )
  }

  if (!knowledge) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">No knowledge data available yet.</p>
          <p className="text-sm text-gray-400 mt-2">
            Process some voice notes to build your knowledge base.
          </p>
        </div>
      </Layout>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getTopItems = (items: Record<string, number>, limit: number = 5) => {
    return Object.entries(items)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
  }

  const getSentimentPercentage = (sentiment: keyof KnowledgeStats['sentimentDistribution']) => {
    const total = Object.values(knowledge.stats.sentimentDistribution).reduce((sum, count) => sum + count, 0)
    return total > 0 ? Math.round((knowledge.stats.sentimentDistribution[sentiment] / total) * 100) : 0
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'insights', label: 'Insights', icon: '💡' },
    { id: 'topics', label: 'Topics', icon: '🏷️' },
    { id: 'contacts', label: 'Contacts', icon: '👥' },
    { id: 'timeline', label: 'Timeline', icon: '📅' },
  ]

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Stats */}
      <GridContainer className="lg:grid-cols-5">
        <GridItem className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{knowledge.stats.totalNotes}</div>
          <div className="text-sm text-gray-500">Total Notes</div>
        </GridItem>
        <GridItem className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{knowledge.stats.totalInsights}</div>
          <div className="text-sm text-gray-500">Key Insights</div>
        </GridItem>
        <GridItem className="p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{knowledge.stats.totalTasks}</div>
          <div className="text-sm text-gray-500">Tasks</div>
        </GridItem>
        <GridItem className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{knowledge.stats.totalMessages}</div>
          <div className="text-sm text-gray-500">Messages</div>
        </GridItem>
        <GridItem className="p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{knowledge.stats.totalOutreach}</div>
          <div className="text-sm text-gray-500">Outreach</div>
        </GridItem>
      </GridContainer>

      {/* Sentiment Distribution */}
      <GridContainer className="md:grid-cols-2">
        <GridItem className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sentiment Distribution</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-green-500">😊</span>
                <span className="text-sm font-medium">Positive</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${getSentimentPercentage('positive')}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">{getSentimentPercentage('positive')}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">😐</span>
                <span className="text-sm font-medium">Neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gray-500 h-2 rounded-full"
                    style={{ width: `${getSentimentPercentage('neutral')}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">{getSentimentPercentage('neutral')}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-red-500">😔</span>
                <span className="text-sm font-medium">Negative</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${getSentimentPercentage('negative')}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">{getSentimentPercentage('negative')}%</span>
              </div>
            </div>
          </div>
        </GridItem>

        <GridItem className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Top Topics</h3>
          <div className="space-y-2">
            {getTopItems(knowledge.content.topTopics).map(([topic, count]) => (
              <div key={topic} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{topic}</span>
                <button
                  onClick={() => setFilter({ type: 'topic', value: topic })}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs hover:bg-blue-200 transition-colors cursor-pointer"
                  title={`View all notes about ${topic}`}
                >
                  {count}
                </button>
              </div>
            ))}
          </div>
        </GridItem>
      </GridContainer>

      {/* Time Range */}
      {knowledge.stats.timeRange.earliest && knowledge.stats.timeRange.latest && (
        <GridItem className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Knowledge Span</h3>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <span className="font-medium">From:</span> {formatDate(knowledge.stats.timeRange.earliest)}
            </div>
            <div>
              <span className="font-medium">To:</span> {formatDate(knowledge.stats.timeRange.latest)}
            </div>
          </div>
        </GridItem>
      )}
    </div>
  )

  const renderInsights = () => (
    <div className="space-y-4">
      {knowledge.content.recentInsights.length > 0 ? (
        <div className="space-y-3">
          {knowledge.content.recentInsights.map((insight, index) => (
            <div key={index} className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-400">
              <div className="flex items-start gap-3">
                <span className="text-yellow-500 text-xl">💡</span>
                <p className="text-yellow-900">{insight}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No insights extracted yet.</p>
        </div>
      )}
    </div>
  )

  const renderTopics = () => (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {getTopItems(knowledge.content.topTopics, 20).map(([topic, count]) => (
          <div key={topic} className="bg-blue-50 rounded-lg p-4 flex items-center justify-between hover:bg-blue-100 transition-colors cursor-pointer"
               onClick={() => setFilter({ type: 'topic', value: topic })}>
            <span className="font-medium text-blue-900">{topic}</span>
            <button className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm hover:bg-blue-300 transition-colors"
                    title={`View all notes about ${topic}`}>
              {count} {count === 1 ? 'note' : 'notes'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  const renderContacts = () => (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {getTopItems(knowledge.content.keyContacts, 20).map(([contact, count]) => (
          <div key={contact} className="bg-green-50 rounded-lg p-4 flex items-center justify-between hover:bg-green-100 transition-colors cursor-pointer"
               onClick={() => setFilter({ type: 'contact', value: contact })}>
            <div className="flex items-center gap-2">
              <span className="text-green-500">👤</span>
              <span className="font-medium text-green-900">{contact}</span>
            </div>
            <button className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm hover:bg-green-300 transition-colors"
                    title={`View all notes mentioning ${contact}`}>
              {count} {count === 1 ? 'mention' : 'mentions'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )

  const renderTimeline = () => (
    <div className="space-y-4">
      {knowledge.content.knowledgeTimeline.map((item, index) => (
        <div key={index} className="flex gap-4 hover:bg-gray-50 p-3 rounded-lg transition-colors cursor-pointer"
             onClick={() => setFilter({ type: 'date', value: item.date.split('T')[0] })}>
          <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                {formatDate(item.date)}
              </span>
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                {item.type}
              </span>
            </div>
            <p className="text-sm text-gray-700">{item.content}</p>
          </div>
        </div>
      ))}
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'insights': return renderInsights()
      case 'topics': return renderTopics()
      case 'contacts': return renderContacts()
      case 'timeline': return renderTimeline()
      default: return renderOverview()
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Project Knowledge</h1>
            <p className="text-gray-600 mt-1">
              Aggregated insights from {knowledge.stats.totalNotes} voice notes
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              Last updated: {formatDate(knowledge.lastUpdated)}
            </div>
            <ExportButton onExport={handleExport} />
          </div>
        </div>

        {/* Search */}
        <div className="max-w-2xl">
          <SearchBar placeholder="Search your knowledge base..." />
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div>
          {renderContent()}
        </div>
      </div>

      {/* Filtered Notes Modal */}
      {filter && (
        <FilteredNotes
          filterType={filter.type}
          filterValue={filter.value}
          onClose={() => setFilter(null)}
        />
      )}
    </Layout>
  )
}