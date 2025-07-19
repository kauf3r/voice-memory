import OpenAI from 'openai'
import { validateAnalysis, type ValidatedAnalysis } from './validation'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Rate limiting configuration
const RATE_LIMIT = {
  whisper: {
    requestsPerMinute: 50,
    maxConcurrent: 5,
  },
  gpt4: {
    requestsPerMinute: 200,
    maxConcurrent: 10,
  }
}

// Simple in-memory rate limiter (in production, use Redis)
class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  
  canMakeRequest(service: string, limit: number): boolean {
    const now = Date.now()
    const key = service
    const requests = this.requests.get(key) || []
    
    // Remove requests older than 1 minute
    const validRequests = requests.filter(time => now - time < 60000)
    
    if (validRequests.length >= limit) {
      return false
    }
    
    validRequests.push(now)
    this.requests.set(key, validRequests)
    return true
  }
}

const rateLimiter = new RateLimiter()

export async function transcribeAudio(file: File): Promise<{ text: string | null; error: Error | null }> {
  try {
    // Check rate limit
    if (!rateLimiter.canMakeRequest('whisper', RATE_LIMIT.whisper.requestsPerMinute)) {
      throw new Error('Rate limit exceeded for Whisper API. Please try again later.')
    }

    console.log('Starting transcription for file:', file.name, 'Size:', file.size)

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      response_format: 'text',
      language: 'en', // Can be made configurable
    })

    console.log('Transcription completed, length:', transcription.length)
    return { text: transcription, error: null }

  } catch (error) {
    console.error('Transcription error:', error)
    
    if (error instanceof Error) {
      // Handle specific OpenAI errors
      if (error.message.includes('rate_limit')) {
        return { text: null, error: new Error('OpenAI rate limit exceeded. Please try again later.') }
      }
      if (error.message.includes('invalid_file')) {
        return { text: null, error: new Error('Invalid audio file format.') }
      }
      if (error.message.includes('file_too_large')) {
        return { text: null, error: new Error('Audio file is too large.') }
      }
      return { text: null, error }
    }
    
    return { text: null, error: new Error('Transcription failed') }
  }
}

export async function analyzeTranscription(
  transcription: string, 
  projectKnowledge: string = ''
): Promise<{ analysis: ValidatedAnalysis | null; error: Error | null; warning?: string }> {
  try {
    // Check rate limit
    if (!rateLimiter.canMakeRequest('gpt4', RATE_LIMIT.gpt4.requestsPerMinute)) {
      throw new Error('Rate limit exceeded for GPT-4 API. Please try again later.')
    }

    console.log('Starting analysis for transcription length:', transcription.length)

    const prompt = `
Analyze this voice note transcription and extract insights in these 7 categories:

1. **Sentiment Analysis**: Classify as Positive, Neutral, or Negative with explanation
2. **Focus Topics**: Identify primary theme and two minor themes (1-2 words each)
3. **Key Tasks**: Separate into "My Tasks" and "Tasks Assigned to Others" with assignee names
4. **Key Ideas & Insights**: Compelling ideas or breakthrough moments
5. **Messages to Draft**: Professional drafts with recipient, subject, and body
6. **Cross-References**: Connections to previous notes and project knowledge updates
7. **Outreach Ideas**: Networking opportunities with contacts, topics, and purposes

Context from Project Knowledge:
${projectKnowledge}

Today's Transcription:
${transcription}

Return ONLY a valid JSON object matching this structure:
{
  "sentiment": {
    "classification": "Positive|Neutral|Negative",
    "explanation": "string"
  },
  "focusTopics": {
    "primary": "string",
    "minor": ["string", "string"]
  },
  "tasks": {
    "myTasks": ["string"],
    "delegatedTasks": [{"task": "string", "assignedTo": "string", "nextSteps": "string"}]
  },
  "keyIdeas": ["string"],
  "messagesToDraft": [{"recipient": "string", "subject": "string", "body": "string"}],
  "crossReferences": {
    "relatedNotes": ["string"],
    "projectKnowledgeUpdates": ["string"]
  },
  "outreachIdeas": [{"contact": "string", "topic": "string", "purpose": "string"}]
}
`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are an expert analyst who extracts actionable insights from voice notes. Always return valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })

    const responseText = completion.choices[0]?.message?.content?.trim()
    
    if (!responseText) {
      throw new Error('Empty response from GPT-4')
    }

    console.log('GPT-4 analysis completed, response length:', responseText.length)

    // Parse JSON response - handle markdown code blocks
    let rawAnalysis
    try {
      // Remove markdown code blocks if present
      let cleanedResponse = responseText.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      rawAnalysis = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Raw response:', responseText)
      throw new Error('Invalid JSON response from GPT-4')
    }

    // Validate the analysis structure
    const { analysis, error: validationError } = validateAnalysis(rawAnalysis)
    
    if (!analysis) {
      throw new Error(`Analysis validation failed: ${validationError}`)
    }

    const result: { analysis: ValidatedAnalysis; error: null; warning?: string } = {
      analysis,
      error: null
    }

    // Add warning if validation had to fix issues
    if (validationError) {
      result.warning = validationError
    }

    return result

  } catch (error) {
    console.error('Analysis error:', error)
    
    if (error instanceof Error) {
      // Handle specific OpenAI errors
      if (error.message.includes('rate_limit')) {
        return { analysis: null, error: new Error('OpenAI rate limit exceeded. Please try again later.') }
      }
      if (error.message.includes('context_length')) {
        return { analysis: null, error: new Error('Text too long for analysis.') }
      }
      return { analysis: null, error }
    }
    
    return { analysis: null, error: new Error('Analysis failed') }
  }
}

export default openai