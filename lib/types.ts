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
  structuredData: {
    dates: Array<{
      date: string
      context: string
      type: 'past' | 'future' | 'deadline' | 'meeting' | 'event'
    }>
    times: Array<{
      time: string
      context: string
      type: 'arrival' | 'departure' | 'meeting' | 'deadline' | 'general'
    }>
    locations: Array<{
      place: string
      context: string
      type: 'destination' | 'origin' | 'meeting_place' | 'reference'
    }>
    numbers: Array<{
      value: string
      context: string
      type: 'quantity' | 'measurement' | 'price' | 'duration' | 'identifier'
    }>
    people: Array<{
      name: string
      context: string
      relationship?: string
    }>
  }
  recordingContext: {
    recordedAt: string
    extractedDate?: string
    timeReferences: string[]
  }
}

export interface ProjectKnowledge {
  id: string
  user_id: string
  content: Record<string, any>
  updated_at: string
}