import { memo } from 'react'

interface NoteTopicProps {
  primaryTopic: string
  minorTopics: string[]
}

function NoteTopic({ primaryTopic, minorTopics }: NoteTopicProps) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-medium text-gray-900 mb-1">
        {primaryTopic}
      </h3>
      {minorTopics.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {minorTopics.map((topic, index) => (
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
  )
}

export default memo(NoteTopic)