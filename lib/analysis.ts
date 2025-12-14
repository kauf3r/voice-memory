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

## Business-in-a-Box Analysis (BIB Framework):
8. **The One Thing**: Identify the SINGLE most important priority or focus mentioned. What is the one thing that, if accomplished, would make everything else easier or unnecessary?
9. **Blockers**: Obstacles, frustrations, or things preventing progress. Include severity (critical/moderate/minor) and potential solutions if mentioned.
10. **Opportunities**: Ideas, possibilities, leads worth exploring. Include time sensitivity (urgent/soon/someday) and suggested next action.
11. **SOP Candidates**: Detect any process or procedure being described. Look for:
    - Explicit triggers: "Here's the process for...", "The way I do this is...", "The steps are..."
    - Procedural language: "First..., then..., finally..."
    - Teaching moments: "If someone else needs to do this..."
    - Corrections: "Actually, the better way is..."
    Assign confidence score 0.0-1.0 based on how clearly a repeatable process is described.
12. **Domain Tags**: Categorize each task, blocker, opportunity, and SOP candidate into domains:
    - WORK: Professional/business tasks
    - PERS: Personal/family matters
    - PROJ: Specific projects
    - IDEA: Ideas to explore later
    - (or infer domain from context)

## Structured Data Extraction:
13. **Dates**: Extract all dates mentioned (past events, future plans, deadlines, meetings)
14. **Times**: Extract specific times (arrival times, departure times, meeting times, deadlines)
15. **Locations**: Extract places mentioned (destinations, origins, meeting places, references like "airstrip")
16. **Numbers**: Extract quantities, measurements, prices, durations, identifiers
17. **People**: Extract names of people mentioned with relationship context

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
  "theOneThing": {
    "description": "The single most important priority",
    "domain": "WORK|PERS|PROJ|IDEA",
    "whyImportant": "Brief explanation of why this matters most"
  },
  "blockers": [
    {
      "description": "What's blocking progress",
      "severity": "critical|moderate|minor",
      "domain": "WORK|PERS|PROJ|IDEA",
      "potentialSolutions": ["solution1", "solution2"]
    }
  ],
  "opportunities": [
    {
      "description": "The opportunity or idea",
      "domain": "WORK|PERS|PROJ|IDEA",
      "timeSensitivity": "urgent|soon|someday",
      "nextAction": "Suggested next step"
    }
  ],
  "sopCandidates": [
    {
      "triggerPhrase": "The exact phrase that triggered detection",
      "processDescription": "Description of the process in steps",
      "suggestedTitle": "A clear SOP title",
      "domain": "WORK|PERS|PROJ|IDEA",
      "confidence": 0.85
    }
  ],
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

Include empty arrays for categories with no data. Use null for theOneThing if no clear priority is mentioned.
Use this EXACT field structure.

Example extractions:
- "I arrived at the airstrip at 3:30 PM" → times: [{"time": "3:30 PM", "context": "arrived at the airstrip", "type": "arrival"}]
- "Meeting with John tomorrow" → dates: [{"date": "tomorrow", "context": "meeting with John", "type": "meeting"}]
- "The most important thing today is finishing the proposal" → theOneThing: {"description": "Finish the proposal", "domain": "WORK", "whyImportant": "Explicitly stated as most important"}
- "I'm stuck because the API documentation is incomplete" → blockers: [{"description": "API documentation incomplete", "severity": "moderate", "domain": "WORK", "potentialSolutions": ["Contact API team", "Check community forums"]}]
- "There's a partnership opportunity with the survey company" → opportunities: [{"description": "Partnership with survey company", "domain": "WORK", "timeSensitivity": "soon", "nextAction": "Schedule intro call"}]
- "The way I process these files is: first I import, then I validate, finally I export" → sopCandidates: [{"triggerPhrase": "The way I process these files is", "processDescription": "1. Import files 2. Validate data 3. Export results", "suggestedTitle": "File Processing Workflow", "domain": "WORK", "confidence": 0.8}]
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