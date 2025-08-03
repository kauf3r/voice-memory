'use client'

import { useState } from 'react'
import { NoteAnalysis } from '@/lib/types'

interface MessageDrafterProps {
  messages: NoteAnalysis['messagesToDraft']
  className?: string
}

interface DraftMessage {
  recipient: string
  subject: string
  body: string
}

export default function MessageDrafter({ messages = [], className = '' }: MessageDrafterProps) {
  const [selectedMessage, setSelectedMessage] = useState<DraftMessage | null>(null)
  const [editedMessage, setEditedMessage] = useState<DraftMessage | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  const handleEditMessage = (message: DraftMessage) => {
    setSelectedMessage(message)
    setEditedMessage({ ...message })
  }

  const handleSaveEdit = () => {
    if (editedMessage) {
      setSelectedMessage(editedMessage)
      setEditedMessage(null)
    }
  }

  const handleCancelEdit = () => {
    setEditedMessage(null)
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopySuccess(type)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const copyFullMessage = (message: DraftMessage) => {
    const fullMessage = `To: ${message.recipient}\nSubject: ${message.subject}\n\n${message.body}`
    copyToClipboard(fullMessage, `full-${message.recipient}`)
  }

  const generateMailtoUrl = (message: DraftMessage) => {
    const subject = encodeURIComponent(message.subject)
    const body = encodeURIComponent(message.body)
    return `mailto:?subject=${subject}&body=${body}`
  }

  if (!messages || messages.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p>No messages to draft identified.</p>
        <p className="text-sm mt-1">AI will suggest messages based on your voice notes.</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Message List */}
      <div className="grid gap-4 md:grid-cols-2">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`bg-white border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
              selectedMessage?.recipient === message.recipient && selectedMessage?.subject === message.subject
                ? 'ring-2 ring-blue-500 border-blue-200'
                : 'border-gray-200'
            }`}
            onClick={() => setSelectedMessage(message)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-blue-500">✉️</span>
                <span className="font-medium text-gray-900 truncate">
                  {message.recipient}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    copyFullMessage(message)
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Copy full message"
                >
                  {copySuccess === `full-${message.recipient}` ? (
                    <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <a
                  href={generateMailtoUrl(message)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Open in email client"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
            <h4 className="font-medium text-gray-900 mb-2 line-clamp-1">
              {message.subject}
            </h4>
            <p className="text-sm text-gray-600 line-clamp-3">
              {message.body}
            </p>
          </div>
        ))}
      </div>

      {/* Detailed View */}
      {selectedMessage && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Message Details</h3>
            <div className="flex items-center gap-2">
              {!editedMessage && (
                <button
                  onClick={() => handleEditMessage(selectedMessage)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => copyFullMessage(selectedMessage)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium"
              >
                {copySuccess === `full-${selectedMessage.recipient}` ? 'Copied!' : 'Copy All'}
              </button>
            </div>
          </div>

          {editedMessage ? (
            // Edit Mode
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient
                </label>
                <input
                  type="text"
                  id="message-recipient"
                  name="recipient"
                  value={editedMessage.recipient}
                  onChange={(e) => setEditedMessage({ ...editedMessage, recipient: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Message recipient"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  id="message-subject"
                  name="subject"
                  value={editedMessage.subject}
                  onChange={(e) => setEditedMessage({ ...editedMessage, subject: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Message subject"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message Body
                </label>
                <textarea
                  id="message-body"
                  name="body"
                  value={editedMessage.body}
                  onChange={(e) => setEditedMessage({ ...editedMessage, body: e.target.value })}
                  rows={8}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Message body"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            // View Mode
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient
                  </label>
                  <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                    <span className="text-gray-900">{selectedMessage.recipient}</span>
                    <button
                      onClick={() => copyToClipboard(selectedMessage.recipient, 'recipient')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {copySuccess === 'recipient' ? (
                        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                    <span className="text-gray-900">{selectedMessage.subject}</span>
                    <button
                      onClick={() => copyToClipboard(selectedMessage.subject, 'subject')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {copySuccess === 'subject' ? (
                        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Message Body
                  </label>
                  <button
                    onClick={() => copyToClipboard(selectedMessage.body, 'body')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {copySuccess === 'body' ? (
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="bg-gray-50 rounded-md p-4">
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.body}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <a
                  href={generateMailtoUrl(selectedMessage)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium inline-flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Open in Email
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}