export interface User {
  id: string
  email: string
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  audio_url: string
  duration_seconds?: number
  transcription?: string
  analysis?: NoteAnalysis
  recorded_at: string
  processed_at?: string
  created_at: string
}

export interface NoteAnalysis {
  sentiment: {
    classification: 'Positive' | 'Neutral' | 'Negative'
    explanation: string
  }
  focusTopics: {
    primary: string
    minor: [string, string]
  }
  tasks: {
    myTasks: string[]
    delegatedTasks: Array<{
      task: string
      assignedTo: string
      nextSteps: string
    }>
  }
  keyIdeas: string[]
  messagesToDraft: Array<{
    recipient: string
    subject: string
    body: string
  }>
  crossReferences: {
    relatedNotes: string[]
    projectKnowledgeUpdates: string[]
  }
  outreachIdeas: Array<{
    contact: string
    topic: string
    purpose: string
  }>
}

export interface ProjectKnowledge {
  id: string
  user_id: string
  content: Record<string, any>
  updated_at: string
}