import { NoteAnalysis } from './types'

/**
 * Simplified Analysis Prompt - Optimized for ADHD-friendly task management
 *
 * Reduced from 17 categories to 6 focused outputs:
 * 1. Summary - One-line overview
 * 2. Mood - Quick emotional gauge
 * 3. Topic - Primary focus area
 * 4. The One Thing - Single most important priority
 * 5. Tasks - Actionable items with NOW/SOON/LATER urgency
 * 6. Draft Messages - Ready-to-send communications
 * 7. People - Relationship tracking
 */
export const ANALYSIS_PROMPT = `
Analyze this voice note and extract actionable insights. Focus on what matters most.

Recording Date: {recordingDate}

Transcription:
{transcription}

Return ONLY valid JSON with this EXACT structure:

{
  "summary": "One sentence summarizing the main point of this recording",

  "mood": "positive|neutral|negative",

  "topic": "Primary topic in 2-4 words (e.g., 'Career Development', 'Project Planning', 'Personal Health')",

  "theOneThing": "The SINGLE most important action or priority mentioned. If none is clear, use null.",

  "tasks": [
    {
      "title": "Short, actionable task title (start with verb)",
      "urgency": "NOW|SOON|LATER",
      "domain": "WORK|PERS|PROJ",
      "dueDate": "Date if mentioned, otherwise null",
      "assignedTo": "Person's name if delegated, otherwise null",
      "context": "Brief context from recording"
    }
  ],

  "draftMessages": [
    {
      "recipient": "Name of person",
      "subject": "Clear email subject line",
      "body": "Professional message body ready to send"
    }
  ],

  "people": [
    {
      "name": "Person's name",
      "context": "How they were mentioned",
      "relationship": "colleague|friend|family|client|vendor|other"
    }
  ],

  "recordedAt": "{recordingDate}"
}

## Task Extraction Rules:

**Urgency Classification (ADHD-friendly NOW/SOON/LATER):**
- NOW: Explicitly urgent, has a deadline today/tomorrow, blocks other work, or speaker shows stress about it
- SOON: Should be done this week, mentioned as important, or has a near-term deadline
- LATER: Nice to have, "someday" items, ideas to explore, no time pressure mentioned

**Domain Classification:**
- WORK: Professional, business, career-related
- PERS: Personal life, family, health, home
- PROJ: Specific named projects (identify from context)

**Task Title Rules:**
- Start with an action verb (Build, Create, Send, Call, Review, Fix, Update, Schedule)
- Keep under 10 words
- Be specific enough to act on without re-reading the transcript
- BAD: "Work on the thing"
- GOOD: "Build dashboard explainer video for Chris"

**Extract tasks from:**
- Explicit "I need to..." or "I should..." statements
- Things the speaker committed to doing
- Follow-ups mentioned
- Delegated items (mark with assignedTo)

## Examples:

Input: "I need to send Chris that dashboard video by Friday, and sometime I should look into that new analytics tool"
Output tasks:
- {title: "Send dashboard video to Chris", urgency: "NOW", domain: "WORK", dueDate: "Friday", context: "Dashboard explainer"}
- {title: "Research new analytics tool", urgency: "LATER", domain: "WORK", context: "Mentioned as low priority"}

Input: "The most important thing right now is getting my rates aligned with market"
Output theOneThing: "Negotiate rate increase to market level"

Include empty arrays [] for categories with no data. Use null for theOneThing if no clear priority.
`

/**
 * V2 Analysis Prompt - Enhanced ADHD-optimized extraction
 *
 * Enhancements over V1:
 * - theOneThing now includes task + why explanation
 * - Tasks include optional: estimatedMinutes, energy level, context tags
 * - New openLoops array for decisions pending and waiting-for items
 * - noteType classification for better organization
 */
export const ANALYSIS_PROMPT_V2 = `
Analyze this voice note for an ADHD brain. Extract actionable insights with physical next actions.

Recording Date: {recordingDate}

Transcription:
{transcription}

Return ONLY valid JSON with this EXACT structure:

{
  "summary": "One sentence summarizing the main point",
  "mood": "positive|neutral|negative",
  "topic": "Primary topic in 2-4 words",
  "noteType": "brain_dump|meeting_debrief|planning|venting|idea_capture",

  "theOneThing": {
    "task": "The SINGLE most important physical action. Format: 'Open X and do Y'",
    "why": "One sentence on why this matters most right now"
  },

  "tasks": [
    {
      "title": "Physical action starting with verb (Open, Call, Send, Walk to...)",
      "urgency": "NOW|SOON|LATER",
      "domain": "WORK|PERS|PROJ",
      "dueDate": "Date if mentioned, otherwise null",
      "assignedTo": "Person's name if delegated, otherwise null",
      "context": "Brief context from recording",
      "estimatedMinutes": 15|30|60|120,
      "energy": "low|medium|high",
      "taskContext": "desk|phone|errand"
    }
  ],

  "openLoops": [
    {
      "type": "decision|waiting_for",
      "description": "What decision is pending or what you're waiting for"
    }
  ],

  "draftMessages": [...],
  "people": [...],
  "recordedAt": "{recordingDate}"
}

## V2 Task Rules:

**Physical Action Format:**
- BAD: "Work on presentation"
- GOOD: "Open Google Slides and add 3 bullet points to intro slide"
- BAD: "Follow up with Sarah"
- GOOD: "Open Slack and send Sarah the budget link"

**Optional Fields (only include when clearly implied):**
- estimatedMinutes: Only if duration mentioned or obvious (quick call = 15, big project = 120)
- energy: low = mindless/routine, medium = focused work, high = creative/difficult
- taskContext: desk = computer work, phone = calls/texts, errand = physical location

**Open Loops - Extract when speaker mentions:**
- Decisions they haven't made yet ("I'm not sure whether to...")
- Things they're waiting on from others ("Once Sarah gets back to me...")
- Unresolved questions ("I need to figure out...")

**Note Type Classification:**
- brain_dump: Stream of consciousness, multiple unrelated topics
- meeting_debrief: Recap of a conversation or meeting
- planning: Organizing future work or events
- venting: Processing emotions, frustrations
- idea_capture: Creative ideas, inspiration, possibilities

Include empty arrays [] for categories with no data. theOneThing can be null if no clear priority.
`

export function buildAnalysisPrompt(
  transcription: string,
  _projectKnowledge: string,  // Kept for API compatibility, not used in simplified prompt
  recordingDate?: string,
  version: 'v1' | 'v2' = 'v2'
): string {
  const date = recordingDate || new Date().toISOString()
  const prompt = version === 'v2' ? ANALYSIS_PROMPT_V2 : ANALYSIS_PROMPT
  return prompt
    .replace(/{recordingDate}/g, date)
    .replace('{transcription}', transcription)
}