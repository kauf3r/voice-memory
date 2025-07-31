import { NoteAnalysis } from './types'
import { createHash } from 'crypto'

// Enhanced analysis configuration
export interface AnalysisConfig {
  model: 'gpt-4' | 'gpt-3.5-turbo'
  temperature: number
  maxTokens: number
  enableMultiPass: boolean
  confidenceThreshold: number
  contextWindow: number
}

// Default configurations by complexity
export const ANALYSIS_CONFIGS = {
  simple: {
    model: 'gpt-3.5-turbo' as const,
    temperature: 0.3,
    maxTokens: 1500,
    enableMultiPass: false,
    confidenceThreshold: 0.7,
    contextWindow: 8192
  },
  standard: {
    model: 'gpt-4' as const,
    temperature: 0.3,
    maxTokens: 2000,
    enableMultiPass: false,
    confidenceThreshold: 0.8,
    contextWindow: 32768
  },
  complex: {
    model: 'gpt-4' as const,
    temperature: 0.2,
    maxTokens: 3000,
    enableMultiPass: true,
    confidenceThreshold: 0.9,
    contextWindow: 32768
  }
}

// Enhanced prompts for each analysis category
export const ANALYSIS_PROMPTS = {
  sentiment: `
## Enhanced Sentiment Analysis
Analyze the emotional tone with:
- Overall sentiment (Positive/Neutral/Negative) with confidence score (0-1)
- Emotional nuances detected (excitement, frustration, hope, concern, etc.)
- Mood progression throughout the note
- Energy level assessment (high/medium/low)
- Confidence indicators in speaker's voice

Provide specific examples from the text supporting your assessment.
`,

  topics: `
## Advanced Topic Extraction
Identify topics with:
- Primary theme (most prominent subject, 2-3 words)
- Secondary themes (supporting topics, ranked by relevance)
- Topic relevance scores (0-1 for each)
- Topic relationships and dependencies
- Domain classification (business, personal, technical, creative, etc.)

Focus on actionable and meaningful topics that provide value for future reference.
`,

  tasks: `
## Intelligent Task Identification
Extract actionable items with:
- Clear action verbs and specific outcomes
- Priority levels (High/Medium/Low) based on urgency and importance
- Estimated effort (Quick/Medium/Complex)
- Dependencies on other tasks or people
- Due dates or time sensitivity
- Context for why this task matters

For delegated tasks, include:
- Assignee with relationship context
- Next steps and follow-up requirements
- Success criteria or deliverables expected
`,

  ideas: `
## Creative Insight Extraction
Capture innovative thoughts with:
- Core concept description
- Potential impact or value
- Implementation feasibility
- Connection to existing projects or knowledge
- Novel aspects or breakthrough potential

Prioritize ideas that are actionable, innovative, or solve specific problems.
`,

  messages: `
## Smart Message Drafting
Create professional communications with:
- Appropriate tone for relationship and context
- Clear subject lines that convey purpose
- Structured body with key points
- Call-to-action or next steps
- Personalization based on recipient relationship

Ensure messages are actionable and provide value to recipients.
`,

  crossReferences: `
## Intelligent Cross-Reference Detection
Identify connections with:
- Similar themes from previous notes
- Related projects or ongoing initiatives
- People mentioned in multiple contexts
- Evolving ideas or recurring patterns
- Progress updates on previous topics

Provide relevance scores and explain the connection significance.
`,

  outreach: `
## Strategic Outreach Opportunities
Identify networking potential with:
- Contact relevance to current goals
- Specific conversation topics or shared interests
- Value proposition for both parties
- Optimal timing and context for outreach
- Potential collaboration opportunities

Focus on mutually beneficial connections with clear purpose.
`
}

// Main enhanced analysis prompt
export const ENHANCED_ANALYSIS_PROMPT = `
You are an expert AI analyst specializing in extracting actionable insights from voice notes. Your goal is to provide comprehensive, accurate, and valuable analysis that helps users make informed decisions and take meaningful action.

## Analysis Instructions:
{analysisInstructions}

## Context Information:
- Recording Date/Time: {recordingDate}
- Transcription Length: {transcriptionLength} characters
- Analysis Complexity: {complexityLevel}
- User's Historical Patterns: {userPatterns}

## Project Knowledge Context:
{projectKnowledge}

## Voice Note Transcription:
{transcription}

## Output Requirements:
Return ONLY a valid JSON object with this EXACT structure, including confidence scores for quality assessment:

{
  "sentiment": {
    "classification": "Positive|Neutral|Negative",
    "explanation": "Detailed explanation with specific examples",
    "confidence": 0.95,
    "nuances": ["excitement", "anticipation"],
    "energyLevel": "high",
    "moodProgression": "started neutral, became enthusiastic"
  },
  "focusTopics": {
    "primary": "Main theme",
    "minor": ["theme1", "theme2"],
    "relevanceScores": [0.95, 0.8, 0.7],
    "domainClassification": "business",
    "topicRelationships": ["theme1 enables theme2"]
  },
  "tasks": {
    "myTasks": [
      {
        "description": "specific action item",
        "priority": "High|Medium|Low",
        "effort": "Quick|Medium|Complex",
        "dueDate": "optional date",
        "context": "why this matters",
        "dependencies": ["other task or person"]
      }
    ],
    "delegatedTasks": [
      {
        "task": "description",
        "assignedTo": "person name",
        "relationship": "colleague|client|friend",
        "nextSteps": "follow-up actions",
        "successCriteria": "expected outcome",
        "priority": "High|Medium|Low"
      }
    ]
  },
  "keyIdeas": [
    {
      "concept": "core idea description",
      "impact": "potential value or significance",
      "feasibility": "implementation difficulty",
      "novelty": "how innovative or unique",
      "connections": ["related projects or knowledge"]
    }
  ],
  "messagesToDraft": [
    {
      "recipient": "name",
      "relationship": "professional context",
      "subject": "clear, actionable subject",
      "body": "structured message content",
      "tone": "professional|casual|formal",
      "urgency": "high|medium|low",
      "callToAction": "specific next step requested"
    }
  ],
  "crossReferences": {
    "relatedNotes": [
      {
        "reference": "note identifier or theme",
        "relevance": 0.8,
        "connectionType": "continuation|update|related",
        "significance": "why this connection matters"
      }
    ],
    "projectKnowledgeUpdates": [
      {
        "update": "knowledge to add or modify",
        "category": "contacts|projects|insights|patterns",
        "confidence": 0.9
      }
    ]
  },
  "outreachIdeas": [
    {
      "contact": "person or organization",
      "topic": "conversation subject",
      "purpose": "collaboration|information|networking",
      "value": "mutual benefit description",
      "timing": "optimal outreach timing",
      "context": "relevant background or connection"
    }
  ],
  "structuredData": {
    "dates": [{"date": "tomorrow", "context": "meeting with John", "type": "meeting", "importance": "high"}],
    "times": [{"time": "3:30 PM", "context": "arrived at the airstrip", "type": "arrival", "precision": "exact"}],
    "locations": [{"place": "airstrip", "context": "arrival location", "type": "destination", "significance": "travel hub"}],
    "numbers": [{"value": "50", "context": "price mentioned", "type": "price", "unit": "dollars"}],
    "people": [{"name": "John", "context": "meeting tomorrow", "relationship": "colleague", "importance": "high"}]
  },
  "recordingContext": {
    "recordedAt": "{recordingDate}",
    "extractedDate": "2025-07-21",
    "timeReferences": ["tomorrow", "next week"],
    "contextualClues": ["morning routine", "commute", "office setting"]
  },
  "analysisMetadata": {
    "version": "2.0",
    "model": "{modelUsed}",
    "processingTime": "{processingTime}ms",
    "overallConfidence": 0.87,
    "complexityScore": 0.6,
    "qualityFlags": ["high_confidence", "complete_analysis"],
    "suggestions": ["consider following up on tasks within 24 hours"]
  }
}

## Quality Guidelines:
- Include empty arrays for categories with no relevant data
- Provide confidence scores for all major insights
- Use specific examples from the transcription
- Ensure all tasks are actionable with clear outcomes
- Maintain consistency in terminology and classification
- Flag any ambiguous or uncertain interpretations

## Few-Shot Examples:
Transcription: "I met with Sarah about the marketing campaign. We need to finalize the budget by Friday and she'll handle the creative brief."

Expected output includes:
- High confidence sentiment analysis
- Clear task separation (my task: finalize budget, delegated: creative brief)
- Proper relationship context (Sarah - colleague)
- Accurate timeline extraction (Friday deadline)
`

// Complexity assessment for intelligent model selection
export function assessTranscriptionComplexity(transcription: string, projectKnowledge: string): {
  level: 'simple' | 'standard' | 'complex'
  score: number
  factors: string[]
  reasoning: string
} {
  const factors: string[] = []
  let score = 0
  
  // Length factor
  if (transcription.length > 2000) {
    score += 0.3
    factors.push('long_transcription')
  }
  
  // Complexity indicators
  const complexityPatterns = [
    /\b(analyze|strategy|implement|budget|timeline|stakeholder)\b/gi,
    /\b(meeting|discussion|decision|proposal|agreement)\b/gi,
    /\b(project|campaign|initiative|deliverable)\b/gi,
    /\b(deadline|priority|urgent|critical)\b/gi
  ]
  
  complexityPatterns.forEach((pattern, index) => {
    const matches = transcription.match(pattern)
    if (matches && matches.length > 2) {
      score += 0.1 * matches.length
      factors.push(`complex_vocabulary_${index}`)
    }
  })
  
  // Multiple people mentioned
  const peopleMatches = transcription.match(/\b[A-Z][a-z]+\b/g) || []
  const uniquePeople = new Set(peopleMatches).size
  if (uniquePeople > 3) {
    score += 0.2
    factors.push('multiple_people')
  }
  
  // Project knowledge richness
  if (projectKnowledge.length > 1000) {
    score += 0.1
    factors.push('rich_context')
  }
  
  // Cross-reference indicators
  const referencePatterns = /\b(like|similar|previous|before|last time|remember)\b/gi
  const references = transcription.match(referencePatterns)
  if (references && references.length > 2) {
    score += 0.15
    factors.push('cross_references')
  }
  
  // Determine complexity level
  let level: 'simple' | 'standard' | 'complex'
  let reasoning: string
  
  if (score < 0.3) {
    level = 'simple'
    reasoning = 'Short transcription with straightforward content'
  } else if (score < 0.7) {
    level = 'standard'
    reasoning = 'Moderate complexity with business context'
  } else {
    level = 'complex'
    reasoning = 'High complexity with multiple factors requiring detailed analysis'
  }
  
  return { level, score, factors, reasoning }
}

// Enhanced prompt builder with intelligent optimization
export function buildEnhancedAnalysisPrompt(
  transcription: string,
  projectKnowledge: string,
  recordingDate?: string,
  userPatterns?: string,
  complexity?: ReturnType<typeof assessTranscriptionComplexity>
): { prompt: string; config: AnalysisConfig } {
  const transcriptionLength = transcription.length
  const complexityAssessment = complexity || assessTranscriptionComplexity(transcription, projectKnowledge)
  const config = ANALYSIS_CONFIGS[complexityAssessment.level]
  
  // Build analysis instructions based on complexity
  let analysisInstructions = ''
  
  if (complexityAssessment.level === 'simple') {
    analysisInstructions = `
Focus on:
- Clear sentiment classification
- 1-3 main topics maximum
- Obvious action items
- Basic structured data extraction

Keep analysis concise and direct.
`
  } else if (complexityAssessment.level === 'standard') {
    analysisInstructions = `
${ANALYSIS_PROMPTS.sentiment}
${ANALYSIS_PROMPTS.topics}
${ANALYSIS_PROMPTS.tasks}
${ANALYSIS_PROMPTS.ideas}
${ANALYSIS_PROMPTS.messages}
${ANALYSIS_PROMPTS.crossReferences}
${ANALYSIS_PROMPTS.outreach}

Provide detailed analysis with confidence scores.
`
  } else {
    analysisInstructions = `
${ANALYSIS_PROMPTS.sentiment}
${ANALYSIS_PROMPTS.topics}
${ANALYSIS_PROMPTS.tasks}
${ANALYSIS_PROMPTS.ideas}
${ANALYSIS_PROMPTS.messages}
${ANALYSIS_PROMPTS.crossReferences}
${ANALYSIS_PROMPTS.outreach}

Perform comprehensive analysis with:
- Multi-layer insight extraction
- Complex relationship mapping
- Historical pattern recognition
- Strategic recommendations
- High confidence thresholds
`
  }
  
  const prompt = ENHANCED_ANALYSIS_PROMPT
    .replace('{analysisInstructions}', analysisInstructions)
    .replace('{projectKnowledge}', projectKnowledge)
    .replace('{transcription}', transcription)
    .replace('{recordingDate}', recordingDate || new Date().toISOString())
    .replace('{transcriptionLength}', transcriptionLength.toString())
    .replace('{complexityLevel}', complexityAssessment.level)
    .replace('{userPatterns}', userPatterns || 'No historical patterns available')
    .replace('{modelUsed}', config.model)
    .replace('{processingTime}', 'TBD')
  
  return { prompt, config }
}

// Legacy function for backward compatibility
export function buildAnalysisPrompt(
  transcription: string,
  projectKnowledge: string,
  recordingDate?: string
): string {
  const { prompt } = buildEnhancedAnalysisPrompt(transcription, projectKnowledge, recordingDate)
  return prompt
}

// Analysis caching utilities
export function generateAnalysisCacheKey(transcription: string, projectKnowledge: string): string {
  const content = `${transcription}-${projectKnowledge}`
  return createHash('sha256').update(content).digest('hex').substring(0, 16)
}

// Cost estimation
export function estimateAnalysisCost(transcription: string, config: AnalysisConfig): number {
  const inputTokens = Math.ceil(transcription.length / 4) // Rough token estimation
  const outputTokens = config.maxTokens
  
  // Pricing per 1K tokens (approximate, should be updated with current rates)
  const pricing = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.001, output: 0.002 }
  }
  
  const modelPricing = pricing[config.model]
  const inputCost = (inputTokens / 1000) * modelPricing.input
  const outputCost = (outputTokens / 1000) * modelPricing.output
  
  return inputCost + outputCost
}