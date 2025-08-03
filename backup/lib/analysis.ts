import { NoteAnalysis } from './types'

export const ANALYSIS_PROMPT = `
Analyze this voice note transcription and extract insights in these categories:

## Core Analysis (7-Point Framework):
1. **Sentiment Analysis**: Classify as Positive, Neutral, or Negative with explanation
2. **Focus Topics**: Identify primary theme and two minor themes (1-2 words each)
3. **Key Tasks**: Separate into "My Tasks" and "Tasks Assigned to Others" with assignee names
4. **Key Ideas & Insights**: Compelling ideas or breakthrough moments
5. **Messages to Draft**: Professional drafts with recipient, subject, and body
6. **Cross-References**: Connections to previous notes and project knowledge updates
7. **Outreach Ideas**: Networking opportunities with contacts, topics, and purposes

## Structured Data Extraction:
8. **Dates**: Extract all dates mentioned (past events, future plans, deadlines, meetings)
9. **Times**: Extract specific times (arrival times, departure times, meeting times, deadlines)
10. **Locations**: Extract places mentioned (destinations, origins, meeting places, references like "airstrip")
11. **Numbers**: Extract quantities, measurements, prices, durations, identifiers
12. **People**: Extract names of people mentioned with relationship context

## Recording Context:
- Recording date/time: {recordingDate}
- Extract any dates/times mentioned relative to recording time
- Note any temporal references ("yesterday", "next week", "in 2 hours")

Context from Project Knowledge:
{projectKnowledge}

Voice Note Transcription:
{transcription}

Return ONLY a valid JSON object with this EXACT structure:
{
  "sentiment": {
    "classification": "Positive|Neutral|Negative",
    "explanation": "Brief explanation"
  },
  "focusTopics": {
    "primary": "Main theme",
    "minor": ["theme1", "theme2"]
  },
  "tasks": {
    "myTasks": ["task1", "task2"],
    "delegatedTasks": [{"task": "description", "assignedTo": "person", "nextSteps": "what's next"}]
  },
  "keyIdeas": ["idea1", "idea2"],
  "messagesToDraft": [{"recipient": "name", "subject": "subject", "body": "message content"}],
  "crossReferences": {
    "relatedNotes": [],
    "projectKnowledgeUpdates": ["update1"]
  },
  "outreachIdeas": [{"contact": "name", "topic": "topic", "purpose": "reason"}],
  "structuredData": {
    "dates": [{"date": "tomorrow", "context": "meeting with John", "type": "meeting"}],
    "times": [{"time": "3:30 PM", "context": "arrived at the airstrip", "type": "arrival"}],
    "locations": [{"place": "airstrip", "context": "arrival location", "type": "destination"}],
    "numbers": [{"value": "50", "context": "price mentioned", "type": "price"}],
    "people": [{"name": "John", "context": "meeting tomorrow", "relationship": "colleague"}]
  },
  "recordingContext": {
    "recordedAt": "{recordingDate}",
    "extractedDate": "2025-07-21",
    "timeReferences": ["tomorrow", "next week"]
  }
}

Include empty arrays for categories with no data. Use this EXACT field structure.

Example structured data extraction:
- "I arrived at the airstrip at 3:30 PM" → times: [{"time": "3:30 PM", "context": "arrived at the airstrip", "type": "arrival"}], locations: [{"place": "airstrip", "context": "arrival location", "type": "destination"}]
- "Meeting with John tomorrow" → people: [{"name": "John", "context": "meeting tomorrow"}], dates: [{"date": "tomorrow", "context": "meeting with John", "type": "meeting"}]
`

export function buildAnalysisPrompt(
  transcription: string,
  projectKnowledge: string,
  recordingDate?: string
): string {
  return ANALYSIS_PROMPT
    .replace('{projectKnowledge}', projectKnowledge)
    .replace('{transcription}', transcription)
    .replace('{recordingDate}', recordingDate || new Date().toISOString())
}