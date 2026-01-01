'use client'

interface NoteTopicProps {
  primaryTopic: string
  minorTopics: string[]
}

export default function NoteTopic({ primaryTopic, minorTopics }: NoteTopicProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center space-x-2">
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
          {primaryTopic}
        </span>
        {minorTopics.slice(0, 2).map((topic, index) => (
          <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">
            {topic}
          </span>
        ))}
        {minorTopics.length > 2 && (
          <span className="text-gray-500 text-xs">
            +{minorTopics.length - 2} more
          </span>
        )}
      </div>
    </div>
  )
}