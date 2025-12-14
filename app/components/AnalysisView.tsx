'use client'

import { NoteAnalysis, AnalysisTask } from '@/lib/types'
import { useState } from 'react'
import MessageDrafter from './MessageDrafter'

interface AnalysisViewProps {
  analysis: NoteAnalysis
  transcription?: string
  audioUrl?: string
  className?: string
}

export default function AnalysisView({
  analysis,
  transcription,
  audioUrl,
  className = ''
}: AnalysisViewProps) {
  const [activeSection, setActiveSection] = useState<string>('overview')

  const getMoodEmoji = (mood: string) => {
    switch (mood?.toLowerCase()) {
      case 'positive': return '😊'
      case 'negative': return '😔'
      default: return '😐'
    }
  }

  const getMoodColor = (mood: string) => {
    switch (mood?.toLowerCase()) {
      case 'positive': return 'bg-green-100 text-green-800 border-green-200'
      case 'negative': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'NOW': return 'bg-red-100 text-red-800 border-red-300'
      case 'SOON': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'LATER': return 'bg-blue-100 text-blue-800 border-blue-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getDomainColor = (domain: string) => {
    switch (domain) {
      case 'WORK': return 'bg-purple-100 text-purple-700'
      case 'PERS': return 'bg-pink-100 text-pink-700'
      case 'PROJ': return 'bg-indigo-100 text-indigo-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  // Group tasks by urgency for display
  const tasksByUrgency = {
    NOW: analysis.tasks?.filter(t => t.urgency === 'NOW') || [],
    SOON: analysis.tasks?.filter(t => t.urgency === 'SOON') || [],
    LATER: analysis.tasks?.filter(t => t.urgency === 'LATER') || []
  }

  const sections = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'tasks', label: 'Tasks', icon: '✅', count: analysis.tasks?.length || 0 },
    { id: 'messages', label: 'Messages', icon: '✉️', count: analysis.draftMessages?.length || 0 },
    { id: 'people', label: 'People', icon: '👥', count: analysis.people?.length || 0 },
  ]

  const renderTaskCard = (task: AnalysisTask, index: number) => (
    <div
      key={index}
      className={`rounded-lg p-4 border-2 ${getUrgencyColor(task.urgency)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getUrgencyColor(task.urgency)}`}>
              {task.urgency}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs ${getDomainColor(task.domain)}`}>
              {task.domain}
            </span>
            {task.assignedTo && (
              <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700">
                → {task.assignedTo}
              </span>
            )}
          </div>
          <p className="font-medium text-gray-900">{task.title}</p>
          {task.context && (
            <p className="text-sm text-gray-600 mt-1">{task.context}</p>
          )}
          {task.dueDate && (
            <p className="text-sm text-gray-500 mt-1">📅 {task.dueDate}</p>
          )}
        </div>
      </div>
    </div>
  )

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
        <p className="text-gray-800 text-lg">{analysis.summary || 'No summary available'}</p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Mood */}
        <div className={`rounded-lg p-4 text-center border ${getMoodColor(analysis.mood)}`}>
          <div className="text-2xl mb-1">{getMoodEmoji(analysis.mood)}</div>
          <div className="text-sm font-medium capitalize">{analysis.mood || 'neutral'}</div>
        </div>

        {/* Topic */}
        <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
          <div className="text-2xl mb-1">🎯</div>
          <div className="text-sm font-medium text-blue-800">{analysis.topic || 'General'}</div>
        </div>

        {/* Tasks Count */}
        <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
          <div className="text-2xl font-bold text-purple-600">{analysis.tasks?.length || 0}</div>
          <div className="text-sm text-purple-600">Tasks</div>
        </div>

        {/* Messages Count */}
        <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
          <div className="text-2xl font-bold text-green-600">{analysis.draftMessages?.length || 0}</div>
          <div className="text-sm text-green-600">Messages</div>
        </div>
      </div>

      {/* The One Thing - Hero Section */}
      {analysis.theOneThing && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6 border-2 border-yellow-300">
          <div className="flex items-start gap-3">
            <span className="text-3xl">⭐</span>
            <div>
              <h3 className="text-sm font-semibold text-yellow-800 uppercase tracking-wide mb-1">
                The One Thing
              </h3>
              <p className="text-xl font-medium text-yellow-900">
                {analysis.theOneThing}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* NOW Tasks Preview */}
      {tasksByUrgency.NOW.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-red-500">🔥</span> Do Now ({tasksByUrgency.NOW.length})
          </h3>
          <div className="space-y-3">
            {tasksByUrgency.NOW.slice(0, 3).map((task, index) => renderTaskCard(task, index))}
            {tasksByUrgency.NOW.length > 3 && (
              <button
                onClick={() => setActiveSection('tasks')}
                className="text-sm text-blue-600 hover:underline"
              >
                +{tasksByUrgency.NOW.length - 3} more NOW tasks →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Audio & Transcription */}
      {(audioUrl || transcription) && (
        <div className="space-y-4 pt-4 border-t">
          {audioUrl && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Audio Recording</h3>
              <audio controls className="w-full">
                <source src={audioUrl} />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {transcription && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Transcription</h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {transcription}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const renderTasks = () => (
    <div className="space-y-6">
      {/* NOW Section */}
      {tasksByUrgency.NOW.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-red-700 mb-3 flex items-center gap-2">
            <span>🔥</span> NOW - Do Today ({tasksByUrgency.NOW.length})
          </h3>
          <div className="space-y-3">
            {tasksByUrgency.NOW.map((task, index) => renderTaskCard(task, index))}
          </div>
        </div>
      )}

      {/* SOON Section */}
      {tasksByUrgency.SOON.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-yellow-700 mb-3 flex items-center gap-2">
            <span>📅</span> SOON - This Week ({tasksByUrgency.SOON.length})
          </h3>
          <div className="space-y-3">
            {tasksByUrgency.SOON.map((task, index) => renderTaskCard(task, index))}
          </div>
        </div>
      )}

      {/* LATER Section */}
      {tasksByUrgency.LATER.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-blue-700 mb-3 flex items-center gap-2">
            <span>📋</span> LATER - Someday ({tasksByUrgency.LATER.length})
          </h3>
          <div className="space-y-3">
            {tasksByUrgency.LATER.map((task, index) => renderTaskCard(task, index))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!analysis.tasks?.length && (
        <div className="text-center py-8 text-gray-500">
          <p>No tasks identified in this recording.</p>
        </div>
      )}
    </div>
  )

  const renderMessages = () => (
    <MessageDrafter messages={analysis.draftMessages} />
  )

  const renderPeople = () => (
    <div className="space-y-4">
      {analysis.people && analysis.people.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {analysis.people.map((person, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                  {person.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{person.name}</h4>
                  {person.relationship && (
                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-600 mt-1">
                      {person.relationship}
                    </span>
                  )}
                  <p className="text-sm text-gray-600 mt-2">{person.context}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No people mentioned in this recording.</p>
        </div>
      )}
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'tasks': return renderTasks()
      case 'messages': return renderMessages()
      case 'people': return renderPeople()
      default: return renderOverview()
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex overflow-x-auto">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeSection === section.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span className="text-base">{section.icon}</span>
              <span className="whitespace-nowrap">{section.label}</span>
              {section.count !== undefined && section.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-gray-200 text-gray-600">
                  {section.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {renderContent()}
      </div>
    </div>
  )
}
