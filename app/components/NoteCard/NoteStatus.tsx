import { memo } from 'react'

interface NoteStatusProps {
  icon: JSX.Element
  text: string
  colorClasses: string
}

function NoteStatus({ icon, text, colorClasses }: NoteStatusProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses}`}>
      <span className="mr-1.5">{icon}</span>
      {text}
    </span>
  )
}

export default memo(NoteStatus)