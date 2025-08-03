import { memo } from 'react'

interface NoteStatsProps {
  myTasks: number
  keyIdeas: number
  messages: number
}

function NoteStats({ myTasks, keyIdeas, messages }: NoteStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="text-center">
        <p className="text-2xl font-semibold text-blue-600">
          {myTasks}
        </p>
        <p className="text-xs text-gray-500">My Tasks</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-semibold text-green-600">
          {keyIdeas}
        </p>
        <p className="text-xs text-gray-500">Key Ideas</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-semibold text-purple-600">
          {messages}
        </p>
        <p className="text-xs text-gray-500">Messages</p>
      </div>
    </div>
  )
}

export default memo(NoteStats)