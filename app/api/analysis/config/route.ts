import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { ANALYSIS_CONFIGS } from '@/lib/analysis'

interface AnalysisConfig {
  id: string
  name: string
  description: string
  model: 'gpt-4' | 'gpt-3.5-turbo'
  temperature: number
  maxTokens: number
  confidenceThreshold: number
  enableMultiPass: boolean
  isActive: boolean
  successRate?: number
  averageCost?: number
  averageConfidence?: number
  testUsers?: string[]
}

// In-memory configuration store (in production, this would be in a database)
let analysisConfigs: AnalysisConfig[] = [
  {
    id: 'simple',
    name: 'Simple Analysis',
    description: 'Fast analysis for straightforward content using GPT-3.5',
    model: 'gpt-3.5-turbo',
    temperature: 0.3,
    maxTokens: 1500,
    confidenceThreshold: 0.7,
    enableMultiPass: false,
    isActive: true
  },
  {
    id: 'standard',
    name: 'Standard Analysis',
    description: 'Balanced analysis with GPT-4 for business content',
    model: 'gpt-4',
    temperature: 0.3,
    maxTokens: 2000,
    confidenceThreshold: 0.8,
    enableMultiPass: false,
    isActive: true
  },
  {
    id: 'complex',
    name: 'Complex Analysis',
    description: 'Comprehensive analysis with multi-pass for complex content',
    model: 'gpt-4',
    temperature: 0.2,
    maxTokens: 3000,
    confidenceThreshold: 0.9,
    enableMultiPass: true,
    isActive: true
  },
  {
    id: 'experimental_fast',
    name: 'Experimental Fast',
    description: 'A/B test config for faster processing',
    model: 'gpt-3.5-turbo',
    temperature: 0.4,
    maxTokens: 1200,
    confidenceThreshold: 0.75,
    enableMultiPass: false,
    isActive: false,
    testUsers: []
  },
  {
    id: 'experimental_precise',
    name: 'Experimental Precise',
    description: 'A/B test config for higher precision',
    model: 'gpt-4',
    temperature: 0.1,
    maxTokens: 2500,
    confidenceThreshold: 0.95,
    enableMultiPass: true,
    isActive: false,
    testUsers: []
  }
]

// GET /api/analysis/config - Get analysis configurations
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

    const url = new URL(request.url)
    const includeInactive = url.searchParams.get('includeInactive') === 'true'
    const userRole = url.searchParams.get('role') || 'user'

    let configs = analysisConfigs

    // Filter based on user role and active status
    if (userRole !== 'admin') {
      configs = configs.filter(config => 
        config.isActive || (config.testUsers && config.testUsers.includes(user.id))
      )
    } else if (!includeInactive) {
      configs = configs.filter(config => config.isActive)
    }

    // Get current default configurations for comparison
    const defaultConfigs = {
      simple: ANALYSIS_CONFIGS.simple,
      standard: ANALYSIS_CONFIGS.standard,
      complex: ANALYSIS_CONFIGS.complex
    }

    return NextResponse.json({
      configs,
      defaultConfigs,
      totalConfigs: analysisConfigs.length,
      activeConfigs: analysisConfigs.filter(c => c.isActive).length,
      experimentalConfigs: analysisConfigs.filter(c => !c.isActive).length
    })

  } catch (error) {
    console.error('Error fetching analysis configs:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch configurations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST /api/analysis/config - Create or update analysis configuration
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
    const { action, config } = body

    if (action === 'create' || action === 'update') {
      // Validate configuration
      const validationError = validateAnalysisConfig(config)
      if (validationError) {
        return NextResponse.json(
          { error: 'Invalid configuration', details: validationError },
          { status: 400 }
        )
      }

      if (action === 'create') {
        // Check if ID already exists
        if (analysisConfigs.find(c => c.id === config.id)) {
          return NextResponse.json(
            { error: 'Configuration ID already exists' },
            { status: 409 }
          )
        }

        analysisConfigs.push({
          ...config,
          testUsers: config.testUsers || []
        })
      } else {
        // Update existing configuration
        const index = analysisConfigs.findIndex(c => c.id === config.id)
        if (index === -1) {
          return NextResponse.json(
            { error: 'Configuration not found' },
            { status: 404 }
          )
        }

        analysisConfigs[index] = {
          ...analysisConfigs[index],
          ...config,
          testUsers: config.testUsers || analysisConfigs[index].testUsers || []
        }
      }

      return NextResponse.json({
        success: true,
        message: `Configuration ${action}d successfully`,
        config: analysisConfigs.find(c => c.id === config.id)
      })

    } else if (action === 'toggle') {
      const configIndex = analysisConfigs.findIndex(c => c.id === config.id)
      if (configIndex === -1) {
        return NextResponse.json(
          { error: 'Configuration not found' },
          { status: 404 }
        )
      }

      analysisConfigs[configIndex].isActive = !analysisConfigs[configIndex].isActive

      return NextResponse.json({
        success: true,
        message: `Configuration ${analysisConfigs[configIndex].isActive ? 'activated' : 'deactivated'}`,
        config: analysisConfigs[configIndex]
      })

    } else if (action === 'addTestUser') {
      const { configId, userId } = config
      const configIndex = analysisConfigs.findIndex(c => c.id === configId)
      
      if (configIndex === -1) {
        return NextResponse.json(
          { error: 'Configuration not found' },
          { status: 404 }
        )
      }

      if (!analysisConfigs[configIndex].testUsers) {
        analysisConfigs[configIndex].testUsers = []
      }

      if (!analysisConfigs[configIndex].testUsers!.includes(userId)) {
        analysisConfigs[configIndex].testUsers!.push(userId)
      }

      return NextResponse.json({
        success: true,
        message: 'Test user added successfully',
        config: analysisConfigs[configIndex]
      })

    } else if (action === 'removeTestUser') {
      const { configId, userId } = config
      const configIndex = analysisConfigs.findIndex(c => c.id === configId)
      
      if (configIndex === -1) {
        return NextResponse.json(
          { error: 'Configuration not found' },
          { status: 404 }
        )
      }

      if (analysisConfigs[configIndex].testUsers) {
        analysisConfigs[configIndex].testUsers = analysisConfigs[configIndex].testUsers!.filter(id => id !== userId)
      }

      return NextResponse.json({
        success: true,
        message: 'Test user removed successfully',
        config: analysisConfigs[configIndex]
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error managing analysis config:', error)
    return NextResponse.json(
      { 
        error: 'Failed to manage configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/analysis/config - Delete analysis configuration
export async function DELETE(request: NextRequest) {
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

    const url = new URL(request.url)
    const configId = url.searchParams.get('id')

    if (!configId) {
      return NextResponse.json(
        { error: 'Configuration ID required' },
        { status: 400 }
      )
    }

    // Prevent deletion of core configurations
    if (['simple', 'standard', 'complex'].includes(configId)) {
      return NextResponse.json(
        { error: 'Cannot delete core configurations' },
        { status: 403 }
      )
    }

    const configIndex = analysisConfigs.findIndex(c => c.id === configId)
    if (configIndex === -1) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    const deletedConfig = analysisConfigs.splice(configIndex, 1)[0]

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully',
      deletedConfig
    })

  } catch (error) {
    console.error('Error deleting analysis config:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Validate analysis configuration
function validateAnalysisConfig(config: any): string | null {
  if (!config.id || typeof config.id !== 'string') {
    return 'Invalid or missing ID'
  }

  if (!config.name || typeof config.name !== 'string') {
    return 'Invalid or missing name'
  }

  if (!config.description || typeof config.description !== 'string') {
    return 'Invalid or missing description'
  }

  if (!['gpt-4', 'gpt-3.5-turbo'].includes(config.model)) {
    return 'Invalid model - must be gpt-4 or gpt-3.5-turbo'
  }

  if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
    return 'Invalid temperature - must be between 0 and 2'
  }

  if (typeof config.maxTokens !== 'number' || config.maxTokens < 100 || config.maxTokens > 4000) {
    return 'Invalid maxTokens - must be between 100 and 4000'
  }

  if (typeof config.confidenceThreshold !== 'number' || config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
    return 'Invalid confidenceThreshold - must be between 0 and 1'
  }

  if (typeof config.enableMultiPass !== 'boolean') {
    return 'Invalid enableMultiPass - must be boolean'
  }

  if (typeof config.isActive !== 'boolean') {
    return 'Invalid isActive - must be boolean'
  }

  return null
}