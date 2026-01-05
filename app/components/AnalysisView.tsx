'use client'

import { NoteAnalysis, AnalysisTask } from '@/lib/types'
import { useState, useMemo } from 'react'
import MessageDrafter from './MessageDrafter'

interface AnalysisViewProps {
  analysis: NoteAnalysis
  transcription?: string
  audioUrl?: string
  className?: string
}

// Open loop type for V2 analysis
interface OpenLoop {
  type: 'decision' | 'waiting_for'
  description: string
}

// Helper to normalize legacy analysis format to new format
function normalizeAnalysis(analysis: any): {
  tasks: AnalysisTask[]
  draftMessages: any[]
  topic: string
  mood: string
  summary: string
  theOneThing: { task: string; why: string } | null
  noteType: string | null
  people: any[]
  openLoops: OpenLoop[]
} {
  // Normalize tasks - handle both array (new) and object (legacy) formats
  let tasks: AnalysisTask[] = []
  if (Array.isArray(analysis.tasks)) {
    tasks = analysis.tasks
  } else if (analysis.tasks && typeof analysis.tasks === 'object') {
    // Legacy format: { myTasks: [], delegatedTasks: [] }
    const legacyTasks = analysis.tasks as { myTasks?: any[]; delegatedTasks?: any[] }
    const myTasks = (legacyTasks.myTasks || []).map((task: any, i: number) => ({
      title: typeof task === 'string' ? task : task.task || task.title || 'Task',
      urgency: 'SOON' as const,
      domain: 'WORK' as const,
      context: typeof task === 'object' ? task.nextSteps : undefined,
    }))
    const delegatedTasks = (legacyTasks.delegatedTasks || []).map((task: any, i: number) => ({
      title: typeof task === 'string' ? task : task.task || task.title || 'Task',
      urgency: 'SOON' as const,
      domain: 'WORK' as const,
      assignedTo: typeof task === 'object' ? task.assignedTo : undefined,
      context: typeof task === 'object' ? task.nextSteps : undefined,
    }))
    tasks = [...myTasks, ...delegatedTasks]
  }

  // Normalize messages - handle both draftMessages (new) and messagesToDraft (legacy)
  const draftMessages = analysis.draftMessages || analysis.messagesToDraft || []

  // Normalize topic - handle both string (new) and object (legacy) formats
  let topic = analysis.topic || ''
  if (!topic && analysis.topics) {
    topic = analysis.topics.primary || analysis.topics[0] || ''
  }

  // Normalize mood - handle both string (new) and object (legacy) formats
  let mood = analysis.mood || 'neutral'
  if (!mood && analysis.sentiment) {
    mood = analysis.sentiment.classification || analysis.sentiment.overall || 'neutral'
  }

  // Summary and theOneThing
  const summary = analysis.summary || analysis.keyIdeas?.[0] || ''

  // theOneThing can be:
  // - V1 string: "Do the thing"
  // - V2 object: { task: "Do the thing", why: "Because it matters" }
  // - Legacy object: { description: "...", whyImportant: "..." }
  let theOneThing: { task: string; why: string } | null = null
  if (analysis.theOneThing) {
    if (typeof analysis.theOneThing === 'string') {
      // V1 format: string only
      theOneThing = { task: analysis.theOneThing, why: '' }
    } else if (typeof analysis.theOneThing === 'object') {
      if (analysis.theOneThing.task) {
        // V2 format: { task, why }
        theOneThing = {
          task: analysis.theOneThing.task,
          why: analysis.theOneThing.why || ''
        }
      } else if (analysis.theOneThing.description) {
        // Legacy format: { description, whyImportant }
        theOneThing = {
          task: analysis.theOneThing.description,
          why: analysis.theOneThing.whyImportant || ''
        }
      }
    }
  }

  // noteType (V2 only)
  const noteType = analysis.noteType || null

  // People
  const people = analysis.people || analysis.mentionedPeople || []

  // Open Loops (V2 only) - decisions pending and waiting-for items
  const openLoops: OpenLoop[] = Array.isArray(analysis.openLoops)
    ? analysis.openLoops.filter((loop: any) => loop.type && loop.description)
    : []

  return { tasks, draftMessages, topic, mood, summary, theOneThing, noteType, people, openLoops }
}

export default function AnalysisView({
  analysis,
  transcription,
  audioUrl,
  className = ''
}: AnalysisViewProps) {
  const [activeSection, setActiveSection] = useState<string>('overview')

  // Normalize the analysis to handle legacy formats
  const normalized = useMemo(() => normalizeAnalysis(analysis), [analysis])

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

  const getNoteTypeEmoji = (type: string) => {
    switch (type) {
      case 'brain_dump': return '🧠'
      case 'meeting_debrief': return '🤝'
      case 'planning': return '📋'
      case 'venting': return '💨'
      case 'idea_capture': return '💡'
      default: return '📝'
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

  // Group tasks by urgency for display (using normalized data)
  const tasksByUrgency = {
    NOW: normalized.tasks.filter(t => t.urgency === 'NOW'),
    SOON: normalized.tasks.filter(t => t.urgency === 'SOON'),
    LATER: normalized.tasks.filter(t => t.urgency === 'LATER')
  }

  const sections = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'tasks', label: 'Tasks', icon: '✅', count: normalized.tasks.length },
    { id: 'openLoops', label: 'Open Loops', icon: '🔄', count: normalized.openLoops.length },
    { id: 'messages', label: 'Messages', icon: '✉️', count: normalized.draftMessages.length },
    { id: 'people', label: 'People', icon: '👥', count: normalized.people.length },
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
        <p className="text-gray-800 text-lg">{normalized.summary || 'No summary available'}</p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Mood */}
        <div className={`rounded-lg p-4 text-center border ${getMoodColor(normalized.mood)}`}>
          <div className="text-2xl mb-1">{getMoodEmoji(normalized.mood)}</div>
          <div className="text-sm font-medium capitalize">{normalized.mood}</div>
        </div>

        {/* Topic */}
        <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
          <div className="text-2xl mb-1">🎯</div>
          <div className="text-sm font-medium text-blue-800">{normalized.topic || 'General'}</div>
        </div>

        {/* Note Type */}
        {normalized.noteType && (
          <div className="bg-indigo-50 rounded-lg p-4 text-center border border-indigo-200">
            <div className="text-2xl mb-1">{getNoteTypeEmoji(normalized.noteType)}</div>
            <div className="text-sm font-medium text-indigo-800 capitalize">
              {normalized.noteType.replace('_', ' ')}
            </div>
          </div>
        )}

        {/* Tasks Count */}
        <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
          <div className="text-2xl font-bold text-purple-600">{normalized.tasks.length}</div>
          <div className="text-sm text-purple-600">Tasks</div>
        </div>

        {/* Messages Count */}
        <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
          <div className="text-2xl font-bold text-green-600">{normalized.draftMessages.length}</div>
          <div className="text-sm text-green-600">Messages</div>
        </div>
      </div>

      {/* The One Thing - Hero Section */}
      {normalized.theOneThing && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6 border-2 border-yellow-300">
          <div className="flex items-start gap-3">
            <span className="text-3xl">⭐</span>
            <div>
              <h3 className="text-sm font-semibold text-yellow-800 uppercase tracking-wide mb-1">
                The One Thing
              </h3>
              <p className="text-xl font-medium text-yellow-900">
                {normalized.theOneThing.task}
              </p>
              {normalized.theOneThing.why && (
                <p className="text-sm text-yellow-700 mt-2">
                  {normalized.theOneThing.why}
                </p>
              )}
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
      {normalized.tasks.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No tasks identified in this recording.</p>
        </div>
      )}
    </div>
  )

  const renderMessages = () => (
    <MessageDrafter messages={normalized.draftMessages} />
  )

  const renderPeople = () => (
    <div className="space-y-4">
      {normalized.people.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {normalized.people.map((person, index) => (
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

  const getOpenLoopIcon = (type: string) => {
    switch (type) {
      case 'decision': return '🤔'
      case 'waiting_for': return '⏳'
      default: return '🔄'
    }
  }

  const getOpenLoopColor = (type: string) => {
    switch (type) {
      case 'decision': return 'bg-amber-50 border-amber-200 text-amber-800'
      case 'waiting_for': return 'bg-cyan-50 border-cyan-200 text-cyan-800'
      default: return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  const renderOpenLoops = () => {
    const decisions = normalized.openLoops.filter(l => l.type === 'decision')
    const waitingFor = normalized.openLoops.filter(l => l.type === 'waiting_for')

    return (
      <div className="space-y-6">
        {/* Description */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Open loops</strong> are unresolved items that take up mental bandwidth.
            Decisions need to be made, and waiting-for items need follow-up.
          </p>
        </div>

        {/* Decisions */}
        {decisions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-amber-700 mb-3 flex items-center gap-2">
              <span>🤔</span> Decisions to Make ({decisions.length})
            </h3>
            <div className="space-y-3">
              {decisions.map((loop, index) => (
                <div
                  key={index}
                  className={`rounded-lg p-4 border-2 ${getOpenLoopColor(loop.type)}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{getOpenLoopIcon(loop.type)}</span>
                    <p className="text-gray-900">{loop.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Waiting For */}
        {waitingFor.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-cyan-700 mb-3 flex items-center gap-2">
              <span>⏳</span> Waiting For ({waitingFor.length})
            </h3>
            <div className="space-y-3">
              {waitingFor.map((loop, index) => (
                <div
                  key={index}
                  className={`rounded-lg p-4 border-2 ${getOpenLoopColor(loop.type)}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{getOpenLoopIcon(loop.type)}</span>
                    <p className="text-gray-900">{loop.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {normalized.openLoops.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-4xl mb-2">🧘</p>
            <p>No open loops identified in this recording.</p>
            <p className="text-sm mt-1">Your mind is clear!</p>
          </div>
        )}
      </div>
    )
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'tasks': return renderTasks()
      case 'openLoops': return renderOpenLoops()
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
