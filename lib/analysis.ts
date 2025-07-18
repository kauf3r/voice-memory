import { NoteAnalysis } from './types'

export const ANALYSIS_PROMPT = `
Analyze this voice note transcription and extract insights in these 7 categories:

1. **Sentiment Analysis**: Classify as Positive, Neutral, or Negative with explanation
2. **Focus Topics**: Identify primary theme and two minor themes (1-2 words each)
3. **Key Tasks**: Separate into "My Tasks" and "Tasks Assigned to Others" with assignee names
4. **Key Ideas & Insights**: Compelling ideas or breakthrough moments
5. **Messages to Draft**: Professional drafts with recipient, subject, and body
6. **Cross-References**: Connections to previous notes and project knowledge updates
7. **Outreach Ideas**: Networking opportunities with contacts, topics, and purposes

Context from Project Knowledge:
{projectKnowledge}

Today's Transcription:
{transcription}

Return ONLY a valid JSON object matching the NoteAnalysis interface.
`

export function buildAnalysisPrompt(
  transcription: string,
  projectKnowledge: string
): string {
  return ANALYSIS_PROMPT.replace('{projectKnowledge}', projectKnowledge).replace(
    '{transcription}',
    transcription
  )
}