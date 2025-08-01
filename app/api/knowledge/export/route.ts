import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic behavior to handle cookies and searchParams
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  console.log('🔍 Export API - GET request started')
  
  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') as 'json' | 'csv' | 'pdf'
    
    if (!format || !['json', 'csv', 'pdf'].includes(format)) {
      console.log('❌ Export API - Invalid format:', format)
      return NextResponse.json(
        { error: 'Invalid format. Must be json, csv, or pdf' },
        { status: 400 }
      )
    }

    console.log('📄 Export API - Format requested:', format)

    // Get user from Authorization header (matching knowledge API pattern)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    console.log('📋 Export API - Auth header present:', !!authHeader)
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Export API - Missing or invalid Authorization header')
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    console.log('🎟️ Export API - Token received (first 20 chars):', token.substring(0, 20) + '...')
    
    // Create client with the provided token (same pattern as knowledge API)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )
    
    console.log('🔐 Export API - Attempting to validate token with Supabase...')
    const { data, error: authError } = await supabase.auth.getUser()
    
    if (authError || !data?.user) {
      console.error('❌ Export API - Authentication failed:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const user = data.user
    console.log('✅ Export API - User authenticated:', user.id)

    // Get aggregated knowledge data (reuse logic from knowledge/route.ts)
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, analysis, transcription, recorded_at, processed_at')
      .eq('user_id', user.id)
      .not('analysis', 'is', null)
      .order('recorded_at', { ascending: false })

    if (notesError) {
      console.error('Failed to fetch notes:', notesError)
      return NextResponse.json(
        { error: 'Failed to fetch knowledge data' },
        { status: 500 }
      )
    }

    const { data: projectKnowledge } = await supabase
      .from('project_knowledge')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log(`📊 Export API - Found ${notes?.length || 0} notes for aggregation`)
    
    const aggregatedData = aggregateKnowledgeFromNotes(notes || [])
    const knowledgeData = {
      ...aggregatedData,
      projectKnowledge: projectKnowledge?.content || {},
      lastUpdated: projectKnowledge?.updated_at || new Date().toISOString(),
    }
    
    console.log(`📤 Export API - Aggregated data includes ${aggregatedData.content.allTasks.length} tasks`)

    // Generate export based on format
    switch (format) {
      case 'json':
        return new NextResponse(JSON.stringify(knowledgeData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="voice-memory-knowledge-${new Date().toISOString().split('T')[0]}.json"`
          }
        })

      case 'csv':
        const csvContent = generateCSV(knowledgeData)
        return new NextResponse(csvContent, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="voice-memory-knowledge-${new Date().toISOString().split('T')[0]}.csv"`
          }
        })

      case 'pdf':
        const htmlContent = generateHTML(knowledgeData)
        return new NextResponse(htmlContent, {
          headers: {
            'Content-Type': 'text/html',
            'Content-Disposition': `attachment; filename="voice-memory-knowledge-${new Date().toISOString().split('T')[0]}.html"`
          }
        })

      default:
        return NextResponse.json(
          { error: 'Unsupported format' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function aggregateKnowledgeFromNotes(notes: any[]) {
  const stats = {
    totalNotes: notes.length,
    totalInsights: 0,
    totalTasks: 0,
    totalMessages: 0,
    totalOutreach: 0,
    sentimentDistribution: {
      positive: 0,
      neutral: 0,
      negative: 0,
    },
    timeRange: {
      earliest: null as string | null,
      latest: null as string | null,
    },
  }

  const aggregatedContent = {
    recentInsights: [] as string[],
    topTopics: {} as Record<string, number>,
    keyContacts: {} as Record<string, number>,
    commonTasks: {} as Record<string, number>,
    allTasks: [] as Array<{
      id: string,
      description: string,
      type: 'myTasks' | 'delegatedTasks',
      date: string,
      noteId: string,
      noteContext?: string,
      nextSteps?: string,
      assignedTo?: string
    }>,
    sentimentTrends: [] as Array<{date: string, sentiment: string}>,
    knowledgeTimeline: [] as Array<{
      date: string,
      type: string,
      content: string,
      noteId: string
    }>,
  }

  for (const note of notes) {
    const analysis = note.analysis
    if (!analysis) continue

    // Update stats
    if (analysis.keyIdeas) {
      stats.totalInsights += analysis.keyIdeas.length
      aggregatedContent.recentInsights.push(...analysis.keyIdeas)
    }

    if (analysis.tasks?.myTasks) {
      stats.totalTasks += analysis.tasks.myTasks.length
      analysis.tasks.myTasks.forEach((task: string | object, index: number) => {
        // Handle both string and object tasks
        const taskDescription = typeof task === 'string' ? task : (task as any).task || 'Unknown task'
        const taskDetails = typeof task === 'object' ? task as any : null
        
        aggregatedContent.commonTasks[taskDescription] = (aggregatedContent.commonTasks[taskDescription] || 0) + 1
        aggregatedContent.allTasks.push({
          id: `${note.id}-my-${index}`,
          description: taskDescription,
          type: 'myTasks',
          date: note.recorded_at,
          noteId: note.id,
          noteContext: analysis.keyIdeas?.[0] || note.transcription?.substring(0, 100) || 'No context available',
          nextSteps: taskDetails?.nextSteps,
          assignedTo: taskDetails?.assignedTo
        })
      })
    }

    if (analysis.tasks?.delegatedTasks) {
      stats.totalTasks += analysis.tasks.delegatedTasks.length
      analysis.tasks.delegatedTasks.forEach((task: string | object, index: number) => {
        // Handle both string and object tasks
        const taskDescription = typeof task === 'string' ? task : (task as any).task || 'Unknown task'
        const taskDetails = typeof task === 'object' ? task as any : null
        
        aggregatedContent.allTasks.push({
          id: `${note.id}-delegated-${index}`,
          description: taskDescription,
          type: 'delegatedTasks',
          date: note.recorded_at,
          noteId: note.id,
          noteContext: analysis.keyIdeas?.[0] || note.transcription?.substring(0, 100) || 'No context available',
          nextSteps: taskDetails?.nextSteps,
          assignedTo: taskDetails?.assignedTo
        })
      })
    }

    if (analysis.messagesToDraft) {
      stats.totalMessages += analysis.messagesToDraft.length
    }

    if (analysis.outreachIdeas) {
      stats.totalOutreach += analysis.outreachIdeas.length
      analysis.outreachIdeas.forEach((idea: any) => {
        aggregatedContent.keyContacts[idea.contact] = (aggregatedContent.keyContacts[idea.contact] || 0) + 1
      })
    }

    // Sentiment distribution
    if (analysis.sentiment?.classification) {
      const sentiment = analysis.sentiment.classification.toLowerCase()
      if (sentiment in stats.sentimentDistribution) {
        stats.sentimentDistribution[sentiment as keyof typeof stats.sentimentDistribution]++
      }
      
      aggregatedContent.sentimentTrends.push({
        date: note.recorded_at,
        sentiment: analysis.sentiment.classification
      })
    }

    // Topics
    if (analysis.focusTopics?.primary) {
      aggregatedContent.topTopics[analysis.focusTopics.primary] = 
        (aggregatedContent.topTopics[analysis.focusTopics.primary] || 0) + 1
    }

    if (analysis.focusTopics?.minor) {
      analysis.focusTopics.minor.forEach((topic: string) => {
        aggregatedContent.topTopics[topic] = (aggregatedContent.topTopics[topic] || 0) + 1
      })
    }

    // Timeline
    if (analysis.keyIdeas?.length > 0) {
      aggregatedContent.knowledgeTimeline.push({
        date: note.recorded_at,
        type: 'insight',
        content: analysis.keyIdeas[0],
        noteId: note.id
      })
    }

    // Time range
    if (!stats.timeRange.earliest || note.recorded_at < stats.timeRange.earliest) {
      stats.timeRange.earliest = note.recorded_at
    }
    if (!stats.timeRange.latest || note.recorded_at > stats.timeRange.latest) {
      stats.timeRange.latest = note.recorded_at
    }
  }

  // Sort and limit aggregated content
  aggregatedContent.recentInsights = aggregatedContent.recentInsights
    .slice(-50)
    .reverse()

  aggregatedContent.allTasks = aggregatedContent.allTasks
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  aggregatedContent.knowledgeTimeline = aggregatedContent.knowledgeTimeline
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20)

  aggregatedContent.sentimentTrends = aggregatedContent.sentimentTrends
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30)

  return {
    stats,
    content: aggregatedContent,
    generatedAt: new Date().toISOString()
  }
}

function generateCSV(data: any): string {
  const lines: string[] = []
  
  // Header
  lines.push('Voice Memory Knowledge Export')
  lines.push(`Generated: ${new Date().toLocaleString()}`)
  lines.push('')
  
  // Stats section
  lines.push('STATISTICS')
  lines.push('Metric,Value')
  lines.push(`Total Notes,${data.stats.totalNotes}`)
  lines.push(`Total Insights,${data.stats.totalInsights}`)
  lines.push(`Total Tasks,${data.stats.totalTasks}`)
  lines.push(`Total Messages,${data.stats.totalMessages}`)
  lines.push(`Total Outreach,${data.stats.totalOutreach}`)
  lines.push(`Positive Sentiment,${data.stats.sentimentDistribution.positive}`)
  lines.push(`Neutral Sentiment,${data.stats.sentimentDistribution.neutral}`)
  lines.push(`Negative Sentiment,${data.stats.sentimentDistribution.negative}`)
  lines.push('')
  
  // Top Topics
  lines.push('TOP TOPICS')
  lines.push('Topic,Count')
  Object.entries(data.content.topTopics)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 10)
    .forEach(([topic, count]) => {
      lines.push(`"${topic}",${count}`)
    })
  lines.push('')
  
  // Key Contacts
  lines.push('KEY CONTACTS')
  lines.push('Contact,Mentions')
  Object.entries(data.content.keyContacts)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 10)
    .forEach(([contact, count]) => {
      lines.push(`"${contact}",${count}`)
    })
  lines.push('')
  
  // All Tasks
  lines.push('ALL TASKS')
  lines.push('Type,Description,Date,Note Context,Assigned To,Next Steps')
  data.content.allTasks.forEach((task: any) => {
    const taskType = task.type === 'myTasks' ? 'My Task' : 'Delegated'
    const date = new Date(task.date).toLocaleDateString()
    const description = task.description.replace(/"/g, '""')
    const context = (task.noteContext || '').replace(/"/g, '""')
    const assignedTo = (task.assignedTo || '').replace(/"/g, '""')
    const nextSteps = (task.nextSteps || '').replace(/"/g, '""')
    
    lines.push(`"${taskType}","${description}","${date}","${context}","${assignedTo}","${nextSteps}"`)
  })
  lines.push('')

  // Recent Insights
  lines.push('RECENT INSIGHTS')
  lines.push('Insight')
  data.content.recentInsights.slice(0, 20).forEach((insight: string) => {
    lines.push(`"${insight.replace(/"/g, '""')}"`)
  })
  
  return lines.join('\n')
}

function generateHTML(data: any): string {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getTopItems = (items: Record<string, number>, limit: number = 5) => {
    return Object.entries(items)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice Memory Knowledge Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #3b82f6; }
        .stat-label { font-size: 12px; color: #64748b; text-transform: uppercase; }
        .section { margin: 30px 0; }
        .section h2 { color: #1e40af; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
        .topic-list, .contact-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
        .topic-item, .contact-item { background: #f1f5f9; padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; }
        .insights-list { background: #fefce8; padding: 20px; border-radius: 8px; border-left: 4px solid #eab308; }
        .insight-item { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎙️ Voice Memory Knowledge Report</h1>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
        ${data.stats.timeRange.earliest ? `<p><strong>Data Range:</strong> ${formatDate(data.stats.timeRange.earliest)} to ${formatDate(data.stats.timeRange.latest)}</p>` : ''}
    </div>

    <div class="section">
        <h2>📊 Overview Statistics</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${data.stats.totalNotes}</div>
                <div class="stat-label">Total Notes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.stats.totalInsights}</div>
                <div class="stat-label">Key Insights</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.stats.totalTasks}</div>
                <div class="stat-label">Tasks</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.stats.totalMessages}</div>
                <div class="stat-label">Messages</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.stats.totalOutreach}</div>
                <div class="stat-label">Outreach</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>😊 Sentiment Distribution</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" style="color: #16a34a;">${data.stats.sentimentDistribution.positive}</div>
                <div class="stat-label">Positive</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #6b7280;">${data.stats.sentimentDistribution.neutral}</div>
                <div class="stat-label">Neutral</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #dc2626;">${data.stats.sentimentDistribution.negative}</div>
                <div class="stat-label">Negative</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>🏷️ Top Topics</h2>
        <div class="topic-list">
            ${getTopItems(data.content.topTopics, 10).map(([topic, count]) => `
                <div class="topic-item">
                    <span>${topic}</span>
                    <span><strong>${count}</strong></span>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="section">
        <h2>👥 Key Contacts</h2>
        <div class="contact-list">
            ${getTopItems(data.content.keyContacts, 10).map(([contact, count]) => `
                <div class="contact-item">
                    <span>${contact}</span>
                    <span><strong>${count}</strong> mentions</span>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="section">
        <h2>✅ All Tasks (${data.content.allTasks.length})</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
            ${data.content.allTasks.map((task: any) => `
                <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 6px; border-left: 3px solid ${task.type === 'myTasks' ? '#8b5cf6' : '#3b82f6'};">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div style="font-weight: bold; color: #1e293b;">
                            ${task.type === 'myTasks' ? '✅ My Task' : '👥 Delegated'}: ${task.description}
                        </div>
                        <div style="font-size: 12px; color: #64748b;">
                            ${new Date(task.date).toLocaleDateString()}
                        </div>
                    </div>
                    ${task.assignedTo ? `<div style="margin: 5px 0; font-size: 14px;"><strong>👤 Assigned to:</strong> ${task.assignedTo}</div>` : ''}
                    ${task.nextSteps ? `<div style="margin: 5px 0; font-size: 14px;"><strong>Next Steps:</strong> ${task.nextSteps}</div>` : ''}
                    <div style="margin-top: 8px; padding: 8px; background: #f1f5f9; border-radius: 4px; font-size: 13px; color: #475569; font-style: italic;">
                        <strong>Context:</strong> "${task.noteContext}"
                    </div>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="section">
        <h2>💡 Recent Insights</h2>
        <div class="insights-list">
            ${data.content.recentInsights.slice(0, 15).map((insight: string) => `
                <div class="insight-item">${insight}</div>
            `).join('')}
        </div>
    </div>
</body>
</html>`
}