'use client'

import { NoteAnalysis } from '@/lib/types'
import { useState } from 'react'
import MessageDrafter from './MessageDrafter'
import { Response } from '@/components/ai-elements/response'
import { InlineCitation, InlineCitationText, InlineCitationCard, InlineCitationCardTrigger, InlineCitationCardBody, InlineCitationSource } from '@/components/ai-elements/inline-citation'
import { Task, TaskTrigger, TaskContent, TaskItem } from '@/components/ai-elements/task'
import { Actions, Action } from '@/components/ai-elements/actions'

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

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'negative':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'neutral':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const sections = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'sentiment', label: 'Sentiment', icon: '💭' },
    { id: 'topics', label: 'Topics', icon: '🏷️' },
    { id: 'tasks', label: 'Tasks', icon: '✅' },
    { id: 'ideas', label: 'Key Ideas', icon: '💡' },
    { id: 'messages', label: 'Messages', icon: '✉️' },
    { id: 'outreach', label: 'Outreach', icon: '🤝' },
    { id: 'references', label: 'References', icon: '🔗' },
  ]

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {analysis.tasks?.myTasks?.length || 0}
          </div>
          <div className="text-sm text-blue-600">My Tasks</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {analysis.keyIdeas?.length || 0}
          </div>
          <div className="text-sm text-green-600">Key Ideas</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {analysis.messagesToDraft?.length || 0}
          </div>
          <div className="text-sm text-purple-600">Messages</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {analysis.outreachIdeas?.length || 0}
          </div>
          <div className="text-sm text-orange-600">Outreach</div>
        </div>
      </div>

      {/* Primary Topic & Sentiment */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Primary Focus</h3>
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 text-xl">
              {analysis.focusTopics?.primary || 'No primary topic identified'}
            </h4>
            {analysis.focusTopics?.minor && (
              <div className="flex gap-2 mt-2">
                {analysis.focusTopics.minor.map((topic, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Sentiment</h3>
          <div className={`rounded-lg p-4 border ${getSentimentColor(analysis.sentiment?.classification || 'neutral')}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">
                {analysis.sentiment?.classification === 'Positive' ? '😊' : 
                 analysis.sentiment?.classification === 'Negative' ? '😔' : '😐'}
              </span>
              <span className="font-semibold">
                {analysis.sentiment?.classification || 'Neutral'}
              </span>
            </div>
            <p className="text-sm opacity-80">
              {analysis.sentiment?.explanation || 'No sentiment analysis available'}
            </p>
          </div>
        </div>
      </div>

      {/* Audio & Transcription */}
      {(audioUrl || transcription) && (
        <div className="space-y-4">
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

  const renderSentiment = () => (
    <div className="space-y-4">
      <div className={`rounded-lg p-6 border-2 ${getSentimentColor(analysis.sentiment?.classification || 'neutral')}`}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">
            {analysis.sentiment?.classification === 'Positive' ? '😊' : 
             analysis.sentiment?.classification === 'Negative' ? '😔' : '😐'}
          </span>
          <div>
            <h3 className="text-xl font-semibold">
              {analysis.sentiment?.classification || 'Neutral'}
            </h3>
            <p className="text-sm opacity-75">Emotional tone of the recording</p>
          </div>
        </div>
        <Response className="text-base">
          {analysis.sentiment?.explanation || 'No detailed sentiment analysis available.'}
        </Response>
      </div>
    </div>
  )

  const renderTopics = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-3">Primary Topic</h3>
        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
          <h4 className="font-semibold text-blue-900 text-lg">
            {analysis.focusTopics?.primary || 'No primary topic identified'}
          </h4>
        </div>
      </div>

      {analysis.focusTopics?.minor && analysis.focusTopics.minor.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Related Topics</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {analysis.focusTopics.minor.map((topic, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 border-l-4 border-gray-400">
                <h4 className="font-medium text-gray-800">{topic}</h4>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderTasks = () => (
    <div className="space-y-6">
      {analysis.tasks?.myTasks && analysis.tasks.myTasks.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">My Tasks</h3>
          <div className="space-y-2">
            {analysis.tasks.myTasks.map((task, index) => (
              <div key={index} className="flex items-start gap-3 bg-blue-50 rounded-lg p-3">
                <div className="w-5 h-5 rounded border-2 border-blue-300 mt-0.5 flex-shrink-0" />
                <span className="text-blue-900">{task}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.tasks?.delegatedTasks && analysis.tasks.delegatedTasks.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Delegated Tasks</h3>
          <div className="space-y-4">
            {analysis.tasks.delegatedTasks.map((task, index) => (
              <div key={index} className="bg-orange-50 rounded-lg p-4 border-l-4 border-orange-400">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-orange-900">Assigned to:</span>
                  <span className="bg-orange-200 text-orange-800 px-2 py-1 rounded text-sm">
                    {task.assignedTo}
                  </span>
                </div>
                <p className="text-orange-900 mb-2">{task.task}</p>
                {task.nextSteps && (
                  <p className="text-sm text-orange-700">
                    <span className="font-medium">Next steps:</span> {task.nextSteps}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(!analysis.tasks?.myTasks?.length && !analysis.tasks?.delegatedTasks?.length) && (
        <div className="text-center py-8 text-gray-500">
          <p>No tasks identified in this recording.</p>
        </div>
      )}
    </div>
  )

  const renderIdeas = () => (
    <div className="space-y-4">
      {analysis.keyIdeas && analysis.keyIdeas.length > 0 ? (
        <div className="space-y-3">
          {analysis.keyIdeas.map((idea, index) => (
            <div key={index} className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-400">
              <div className="flex items-start gap-3">
                <span className="text-yellow-500 text-xl">💡</span>
                <p className="text-yellow-900">{idea}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No key ideas identified in this recording.</p>
        </div>
      )}
    </div>
  )

  const renderMessages = () => (
    <MessageDrafter messages={analysis.messagesToDraft} />
  )

  const renderOutreach = () => (
    <div className="space-y-4">
      {analysis.outreachIdeas && analysis.outreachIdeas.length > 0 ? (
        <div className="space-y-3">
          {analysis.outreachIdeas.map((idea, index) => (
            <div key={index} className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-start gap-3">
                <span className="text-green-500 text-xl">🤝</span>
                <div className="flex-1">
                  <h4 className="font-medium text-green-900 mb-1">{idea.contact}</h4>
                  <p className="text-green-800 mb-2">{idea.topic}</p>
                  <p className="text-sm text-green-700">{idea.purpose}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>No outreach opportunities identified.</p>
        </div>
      )}
    </div>
  )

  const renderReferences = () => (
    <div className="space-y-6">
      {analysis.crossReferences?.relatedNotes && analysis.crossReferences.relatedNotes.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Related Notes</h3>
          <div className="space-y-2">
            {analysis.crossReferences.relatedNotes.map((note, index) => (
              <div key={index} className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-400">
                <InlineCitation>
                  <InlineCitationText className="text-blue-900">
                    {note}
                  </InlineCitationText>
                  <InlineCitationCard>
                    <InlineCitationCardTrigger sources={['voice-memory://related-note']} />
                    <InlineCitationCardBody>
                      <InlineCitationSource 
                        title="Related Voice Note"
                        description={`Connection identified by AI analysis: "${note.substring(0, 100)}${note.length > 100 ? '...' : ''}"`}
                        url="voice-memory://cross-reference"
                      />
                    </InlineCitationCardBody>
                  </InlineCitationCard>
                </InlineCitation>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.crossReferences?.projectKnowledgeUpdates && analysis.crossReferences.projectKnowledgeUpdates.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Knowledge Updates</h3>
          <div className="space-y-2">
            {analysis.crossReferences.projectKnowledgeUpdates.map((update, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3 border-l-4 border-gray-400">
                <Response className="text-gray-900">
                  {update}
                </Response>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!analysis.crossReferences?.relatedNotes?.length && !analysis.crossReferences?.projectKnowledgeUpdates?.length) && (
        <div className="text-center py-8 text-gray-500">
          <p>No cross-references identified.</p>
        </div>
      )}
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'sentiment': return renderSentiment()
      case 'topics': return renderTopics()
      case 'tasks': return renderTasks()
      case 'ideas': return renderIdeas()
      case 'messages': return renderMessages()
      case 'outreach': return renderOutreach()
      case 'references': return renderReferences()
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