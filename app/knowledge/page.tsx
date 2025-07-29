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
  allTasks: Array<{
    id: string
    description: string
    type: 'myTasks' | 'delegatedTasks'
    date: string
    noteId: string
    noteContext?: string
    nextSteps?: string
    assignedTo?: string
  }>
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
  const [taskFilter, setTaskFilter] = useState<'all' | 'myTasks' | 'delegatedTasks'>('all')

  const fetchKnowledge = async () => {
    if (!user) return

    try {
      setError(null)
      
      console.log('🔍 fetchKnowledge called for user:', user.email)
      
      // Get the current session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      console.log('📋 Session check:', { hasSession: !!session, sessionError })
      console.log('👤 User in session:', session?.user?.email)
      
      if (!session) {
        throw new Error('No active session. Please log in again.')
      }

      console.log('📡 Making API request to /api/knowledge')
      const response = await fetch('/api/knowledge', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch knowledge data')
      }

      const data = await response.json()
      console.log('📊 API response received:', { success: data.success, hasKnowledge: !!data.knowledge })
      
      if (data.knowledge?.stats) {
        console.log('📈 Knowledge stats:', data.knowledge.stats)
      }
      
      setKnowledge(data.knowledge)
    } catch (err) {
      console.error('❌ fetchKnowledge error:', err)
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

  if (!knowledge || !knowledge.stats || knowledge.stats.totalNotes === 0) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="max-w-md mx-auto">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Knowledge Available</h3>
            <p className="text-gray-500 mb-4">
              Your knowledge base is empty. Upload and process some voice notes to build your insights.
            </p>
            <a
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Upload Voice Notes
            </a>
          </div>
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
    if (!knowledge?.stats?.sentimentDistribution) return 0
    const total = Object.values(knowledge.stats.sentimentDistribution).reduce((sum, count) => sum + count, 0)
    return total > 0 ? Math.round((knowledge.stats.sentimentDistribution[sentiment] / total) * 100) : 0
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'insights', label: 'Insights', icon: '💡' },
    { id: 'tasks', label: 'Tasks', icon: '✅' },
    { id: 'topics', label: 'Topics', icon: '🏷️' },
    { id: 'contacts', label: 'Contacts', icon: '👥' },
    { id: 'timeline', label: 'Timeline', icon: '📅' },
  ]

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Stats */}
      <GridContainer className="lg:grid-cols-5">
        <GridItem className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('timeline')}>
          <div className="text-2xl font-bold text-blue-600">{knowledge?.stats?.totalNotes || 0}</div>
          <div className="text-sm text-gray-500">Total Notes</div>
        </GridItem>
        <GridItem className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('insights')}>
          <div className="text-2xl font-bold text-green-600">{knowledge?.stats?.totalInsights || 0}</div>
          <div className="text-sm text-gray-500">Key Insights</div>
        </GridItem>
        <GridItem className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('tasks')}>
          <div className="text-2xl font-bold text-purple-600">{knowledge?.stats?.totalTasks || 0}</div>
          <div className="text-sm text-gray-500">Tasks</div>
        </GridItem>
        <GridItem className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
          <div className="text-2xl font-bold text-orange-600">{knowledge?.stats?.totalMessages || 0}</div>
          <div className="text-sm text-gray-500">Messages</div>
        </GridItem>
        <GridItem className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab('contacts')}>
          <div className="text-2xl font-bold text-red-600">{knowledge?.stats?.totalOutreach || 0}</div>
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
            {getTopItems(knowledge.content?.topTopics || {}).map(([topic, count]) => (
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
      {knowledge?.stats?.timeRange?.earliest && knowledge?.stats?.timeRange?.latest && (
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
      {(knowledge.content?.recentInsights || []).length > 0 ? (
        <div className="space-y-3">
          {(knowledge.content?.recentInsights || []).map((insight, index) => (
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
        {getTopItems(knowledge.content?.topTopics || {}, 20).map(([topic, count]) => (
          <div key={topic} className="bg-blue-50 rounded-lg p-4 flex items-center justify-between hover:bg-blue-100 transition-colors cursor-pointer"
               onClick={() => setFilter({ type: 'topic', value: topic })}>
            <span className="font-medium text-blue-900">{topic}</span>
            <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm hover:bg-blue-300 transition-colors"
                  title={`View all notes about ${topic}`}>
              {count} {count === 1 ? 'note' : 'notes'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  const renderContacts = () => (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {getTopItems(knowledge.content?.keyContacts || {}, 20).map(([contact, count]) => (
          <div key={contact} className="bg-green-50 rounded-lg p-4 flex items-center justify-between hover:bg-green-100 transition-colors cursor-pointer"
               onClick={() => setFilter({ type: 'contact', value: contact })}>
            <div className="flex items-center gap-2">
              <span className="text-green-500">👤</span>
              <span className="font-medium text-green-900">{contact}</span>
            </div>
            <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm hover:bg-green-300 transition-colors"
                  title={`View all notes mentioning ${contact}`}>
              {count} {count === 1 ? 'mention' : 'mentions'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  const renderTasks = () => {
    const tasks = knowledge.content?.allTasks || []
    const filteredTasks = tasks.filter(task => 
      taskFilter === 'all' || task.type === taskFilter
    )

    const myTasksCount = tasks.filter(t => t.type === 'myTasks').length
    const delegatedTasksCount = tasks.filter(t => t.type === 'delegatedTasks').length

    return (
      <div className="space-y-6">
        {/* Task Filter */}
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setTaskFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                taskFilter === 'all'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Tasks ({tasks.length})
            </button>
            <button
              onClick={() => setTaskFilter('myTasks')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                taskFilter === 'myTasks'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              My Tasks ({myTasksCount})
            </button>
            <button
              onClick={() => setTaskFilter('delegatedTasks')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                taskFilter === 'delegatedTasks'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Delegated ({delegatedTasksCount})
            </button>
          </div>
          <div className="text-sm text-gray-500">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-purple-500">
                        {task.type === 'myTasks' ? '✅' : '👥'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.type === 'myTasks'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {task.type === 'myTasks' ? 'My Task' : 'Delegated'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(task.date)}
                      </span>
                    </div>
                    <p className="text-gray-900 font-medium mb-2">{task.description}</p>
                    
                    {/* Additional task details for delegated tasks */}
                    {task.assignedTo && (
                      <div className="mb-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          👤 Assigned to: {task.assignedTo}
                        </span>
                      </div>
                    )}
                    
                    {task.nextSteps && (
                      <div className="mb-2">
                        <div className="text-xs text-gray-500 mb-1">Next Steps:</div>
                        <p className="text-sm text-gray-700">{task.nextSteps}</p>
                      </div>
                    )}
                    
                    {task.noteContext && (
                      <div className="bg-gray-50 rounded p-3">
                        <div className="text-xs text-gray-500 mb-1">Context from note:</div>
                        <p className="text-sm text-gray-600 italic">"{task.noteContext}"</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setFilter({ type: 'date', value: task.date.split('T')[0] })}
                    className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
                    title="View source note"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="mb-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <p>No tasks found for the selected filter.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderTimeline = () => (
    <div className="space-y-4">
      {(knowledge.content?.knowledgeTimeline || []).map((item, index) => {
        if (!item || !item.date) return null
        return (
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
        )
      })}
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'insights': return renderInsights()
      case 'tasks': return renderTasks()
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
              Aggregated insights from {knowledge?.stats?.totalNotes || 0} voice notes
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              Last updated: {knowledge?.lastUpdated ? formatDate(knowledge.lastUpdated) : 'Never'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                title="Refresh knowledge base"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <a
                href="/"
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Note
              </a>
              <ExportButton onExport={handleExport} />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-2xl">
          <SearchBar placeholder="Search your knowledge base..." />
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const getTabCount = () => {
                switch (tab.id) {
                  case 'insights': return knowledge?.stats?.totalInsights || 0
                  case 'tasks': return knowledge?.stats?.totalTasks || 0
                  case 'topics': return Object.keys(knowledge?.content?.topTopics || {}).length
                  case 'contacts': return Object.keys(knowledge?.content?.keyContacts || {}).length
                  case 'timeline': return knowledge?.content?.knowledgeTimeline?.length || 0
                  default: return null
                }
              }
              
              const count = getTabCount()
              
              return (
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
                  {count !== null && count > 0 && (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
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