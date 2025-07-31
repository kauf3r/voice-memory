import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { analyzeTranscriptionEnhanced, analyzeTranscriptionMultiPass } from '@/lib/openai'
import { assessTranscriptionComplexity, buildEnhancedAnalysisPrompt } from '@/lib/analysis'
import { validateAnalysis } from '@/lib/validation'

interface TestCase {
  id: string
  name: string
  description: string
  transcription: string
  expectedResults?: {
    sentiment?: 'Positive' | 'Neutral' | 'Negative'
    taskCount?: number
    ideaCount?: number
    complexity?: 'simple' | 'standard' | 'complex'
  }
  projectKnowledge?: string
}

// Predefined test cases for analysis validation
const TEST_CASES: TestCase[] = [
  {
    id: 'simple_task',
    name: 'Simple Task Note',
    description: 'Basic voice note with simple tasks',
    transcription: 'I need to call John about the project proposal by Friday. Also, remember to pick up groceries on the way home.',
    expectedResults: {
      sentiment: 'Neutral',
      taskCount: 2,
      complexity: 'simple'
    }
  },
  {
    id: 'business_meeting',
    name: 'Business Meeting Summary',
    description: 'Complex business meeting with multiple stakeholders',
    transcription: 'Had a great meeting with Sarah from marketing and Tom from engineering. We discussed the Q4 campaign strategy. Sarah will prepare the creative brief by next Tuesday, and Tom will provide technical requirements by Wednesday. I need to schedule a follow-up with the CEO to get budget approval. The campaign looks promising and could increase our market share by 15%. We should also reach out to the PR agency for media placement.',
    expectedResults: {
      sentiment: 'Positive',
      taskCount: 3,
      ideaCount: 2,
      complexity: 'complex'
    },
    projectKnowledge: '{"recentProjects": ["Q4 Campaign", "Market Share Growth"], "contacts": ["Sarah - Marketing", "Tom - Engineering"]}'
  },
  {
    id: 'creative_brainstorm',
    name: 'Creative Brainstorming Session',
    description: 'Creative session with multiple ideas and connections',
    transcription: 'Brilliant idea during my morning walk! We could create a mobile app that connects local farmers with restaurants. It would solve the supply chain issue we discussed last month. The app could have features like real-time inventory, quality ratings, and delivery scheduling. This could revolutionize local food systems. I should talk to Maya about the technical feasibility and contact that investor we met at the conference.',
    expectedResults: {
      sentiment: 'Positive',
      taskCount: 2,
      ideaCount: 4,
      complexity: 'standard'
    }
  },
  {
    id: 'problem_solving',
    name: 'Problem Solving Note',
    description: 'Voice note about resolving issues',
    transcription: 'The server went down again this morning. This is the third time this month. I need to investigate the root cause and implement a permanent solution. Maybe we should consider migrating to a more reliable hosting provider. Also need to set up better monitoring and alerting. This is affecting customer satisfaction and our reputation.',
    expectedResults: {
      sentiment: 'Negative',
      taskCount: 3,
      complexity: 'standard'
    }
  },
  {
    id: 'personal_reflection',
    name: 'Personal Reflection',
    description: 'Personal thoughts and reflections',
    transcription: 'Feeling grateful today. The presentation went really well, and the team responded positively to the new strategy. I think we\'re on the right track. Need to remember to celebrate these wins more often. Also, should plan something special for the team to show appreciation.',
    expectedResults: {
      sentiment: 'Positive',
      taskCount: 1,
      complexity: 'simple'
    }
  }
]

// POST /api/analysis/test - Run analysis tests
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      testCases = ['all'], 
      analysisType = 'enhanced', // 'enhanced', 'multipass', 'compare'
      includePromptAnalysis = false,
      validateResults = true
    } = body

    const startTime = Date.now()
    const results: any[] = []

    // Determine which test cases to run
    const casesToRun = testCases.includes('all') 
      ? TEST_CASES 
      : TEST_CASES.filter(tc => testCases.includes(tc.id))

    console.log(`Running ${casesToRun.length} test cases with ${analysisType} analysis`)

    for (const testCase of casesToRun) {
      const testStartTime = Date.now()
      
      try {
        // Assess complexity
        const complexity = assessTranscriptionComplexity(
          testCase.transcription, 
          testCase.projectKnowledge || ''
        )

        let analysisResult: any = {}

        if (analysisType === 'enhanced' || analysisType === 'compare') {
          // Run enhanced analysis
          const enhancedResult = await analyzeTranscriptionEnhanced(
            testCase.transcription,
            testCase.projectKnowledge || '',
            new Date().toISOString(),
            undefined,
            { skipCache: true } // Skip cache for testing
          )
          
          analysisResult.enhanced = {
            analysis: enhancedResult.analysis,
            error: enhancedResult.error?.message,
            metadata: enhancedResult.metadata
          }
        }

        if (analysisType === 'multipass' || analysisType === 'compare') {
          // Run multi-pass analysis
          const multiPassResult = await analyzeTranscriptionMultiPass(
            testCase.transcription,
            testCase.projectKnowledge || '',
            new Date().toISOString()
          )
          
          analysisResult.multipass = {
            analysis: multiPassResult.analysis,
            error: multiPassResult.error?.message,
            passes: multiPassResult.passes
          }
        }

        // Validate results if requested
        let validationResults: any = {}
        if (validateResults) {
          const primaryAnalysis = analysisResult.enhanced?.analysis || analysisResult.multipass?.analysis
          
          if (primaryAnalysis) {
            // Test validation
            const { analysis: validatedAnalysis, error: validationError } = validateAnalysis(primaryAnalysis)
            validationResults = {
              isValid: !validationError,
              validationError,
              hasAllRequiredFields: checkRequiredFields(validatedAnalysis)
            }
            
            // Compare with expected results
            if (testCase.expectedResults) {
              validationResults.expectedComparison = compareWithExpected(primaryAnalysis, testCase.expectedResults)
            }
          }
        }

        // Include prompt analysis if requested
        let promptAnalysis: any = {}
        if (includePromptAnalysis) {
          const { prompt, config } = buildEnhancedAnalysisPrompt(
            testCase.transcription,
            testCase.projectKnowledge || '',
            new Date().toISOString()
          )
          
          promptAnalysis = {
            promptLength: prompt.length,
            estimatedTokens: Math.ceil(prompt.length / 4),
            selectedConfig: config,
            complexity: complexity
          }
        }

        const testResult = {
          testCase: {
            id: testCase.id,
            name: testCase.name,
            description: testCase.description,
            transcriptionLength: testCase.transcription.length
          },
          complexity,
          analysis: analysisResult,
          validation: validationResults,
          prompt: promptAnalysis,
          performance: {
            processingTime: Date.now() - testStartTime,
            timestamp: new Date().toISOString()
          }
        }

        results.push(testResult)
        console.log(`✅ Test case ${testCase.id} completed in ${testResult.performance.processingTime}ms`)

      } catch (error) {
        const errorResult = {
          testCase: {
            id: testCase.id,
            name: testCase.name,
            description: testCase.description
          },
          error: error instanceof Error ? error.message : 'Unknown error',
          performance: {
            processingTime: Date.now() - testStartTime,
            failed: true
          }
        }
        
        results.push(errorResult)
        console.error(`❌ Test case ${testCase.id} failed:`, error)
      }
    }

    // Generate summary statistics
    const summary = generateTestSummary(results)

    return NextResponse.json({
      success: true,
      summary,
      results,
      performance: {
        totalTime: Date.now() - startTime,
        averageTestTime: results.length > 0 ? (Date.now() - startTime) / results.length : 0
      },
      metadata: {
        testCases: casesToRun.length,
        analysisType,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error running analysis tests:', error)
    return NextResponse.json(
      { 
        error: 'Failed to run analysis tests',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET /api/analysis/test - Get available test cases
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      testCases: TEST_CASES.map(tc => ({
        id: tc.id,
        name: tc.name,
        description: tc.description,
        transcriptionLength: tc.transcription.length,
        hasExpectedResults: !!tc.expectedResults,
        hasProjectKnowledge: !!tc.projectKnowledge
      })),
      totalTestCases: TEST_CASES.length,
      analysisTypes: ['enhanced', 'multipass', 'compare'],
      availableOptions: {
        includePromptAnalysis: 'Include detailed prompt analysis',
        validateResults: 'Validate analysis structure and content',
        skipCache: 'Always used in tests for consistent results'
      }
    })

  } catch (error) {
    console.error('Error fetching test cases:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch test cases',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Check if analysis has all required fields
function checkRequiredFields(analysis: any): { [key: string]: boolean } {
  return {
    sentiment: !!(analysis?.sentiment?.classification && analysis?.sentiment?.explanation),
    focusTopics: !!(analysis?.focusTopics?.primary && analysis?.focusTopics?.minor?.length >= 2),
    tasks: !!(analysis?.tasks && (analysis.tasks.myTasks?.length > 0 || analysis.tasks.delegatedTasks?.length > 0)),
    structuredData: !!(analysis?.structuredData),
    recordingContext: !!(analysis?.recordingContext?.recordedAt)
  }
}

// Compare analysis results with expected results
function compareWithExpected(analysis: any, expected: any): { [key: string]: any } {
  const comparison: { [key: string]: any } = {}

  if (expected.sentiment) {
    comparison.sentiment = {
      expected: expected.sentiment,
      actual: analysis?.sentiment?.classification,
      match: analysis?.sentiment?.classification === expected.sentiment
    }
  }

  if (expected.taskCount !== undefined) {
    const actualTaskCount = (analysis?.tasks?.myTasks?.length || 0) + (analysis?.tasks?.delegatedTasks?.length || 0)
    comparison.taskCount = {
      expected: expected.taskCount,
      actual: actualTaskCount,
      match: actualTaskCount === expected.taskCount,
      difference: actualTaskCount - expected.taskCount
    }
  }

  if (expected.ideaCount !== undefined) {
    const actualIdeaCount = analysis?.keyIdeas?.length || 0
    comparison.ideaCount = {
      expected: expected.ideaCount,
      actual: actualIdeaCount,
      match: actualIdeaCount === expected.ideaCount,
      difference: actualIdeaCount - expected.ideaCount
    }
  }

  if (expected.complexity) {
    const actualComplexity = analysis?.analysisMetadata?.complexity || 'unknown'
    comparison.complexity = {
      expected: expected.complexity,
      actual: actualComplexity,
      match: actualComplexity === expected.complexity
    }
  }

  return comparison
}

// Generate test summary statistics
function generateTestSummary(results: any[]): any {
  const successful = results.filter(r => !r.error)
  const failed = results.filter(r => r.error)
  
  const avgProcessingTime = successful.length > 0 
    ? successful.reduce((sum, r) => sum + r.performance.processingTime, 0) / successful.length 
    : 0

  const validationStats = successful.reduce((stats, r) => {
    if (r.validation?.isValid) stats.valid++
    if (r.validation?.expectedComparison) {
      Object.entries(r.validation.expectedComparison).forEach(([key, value]: [string, any]) => {
        if (!stats.expectedMatches[key]) stats.expectedMatches[key] = { matches: 0, total: 0 }
        stats.expectedMatches[key].total++
        if (value.match) stats.expectedMatches[key].matches++
      })
    }
    return stats
  }, { valid: 0, expectedMatches: {} as any })

  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    successRate: results.length > 0 ? (successful.length / results.length) * 100 : 0,
    averageProcessingTime: Math.round(avgProcessingTime),
    validation: {
      validAnalyses: validationStats.valid,
      validationRate: successful.length > 0 ? (validationStats.valid / successful.length) * 100 : 0,
      expectedMatchRates: Object.entries(validationStats.expectedMatches).reduce((rates, [key, value]: [string, any]) => {
        rates[key] = value.total > 0 ? (value.matches / value.total) * 100 : 0
        return rates
      }, {} as any)
    },
    errors: failed.map(r => ({ testCase: r.testCase.id, error: r.error }))
  }
}