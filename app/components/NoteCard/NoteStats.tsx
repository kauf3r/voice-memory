'use client'

interface NoteStatsProps {
  myTasks: number
  keyIdeas: number
  messages: number
}

export default function NoteStats({ myTasks, keyIdeas, messages }: NoteStatsProps) {
  return (
    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
      {myTasks > 0 && (
        <span className="flex items-center space-x-1">
          <span>📋</span>
          <span>{myTasks} tasks</span>
        </span>
      )}
      {keyIdeas > 0 && (
        <span className="flex items-center space-x-1">
          <span>💡</span>
          <span>{keyIdeas} ideas</span>
        </span>
      )}
      {messages > 0 && (
        <span className="flex items-center space-x-1">
          <span>💬</span>
          <span>{messages} messages</span>
        </span>
      )}
    </div>
  )
}