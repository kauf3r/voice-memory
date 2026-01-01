// Temporarily disabled Trello import due to build issues
// import Trello from 'trello.js'

export interface VoiceMemoryTask {
  id: string
  description: string
  type: 'myTasks' | 'delegatedTasks'
  date: string
  noteId: string
  noteContext?: string
  nextSteps?: string
  assignedTo?: string
}

export interface ExportOptions {
  boardName?: string
  includeCompleted?: boolean
  dateRange?: { start: Date; end: Date }
  taskTypes?: ('myTasks' | 'delegatedTasks')[]
  assignedTo?: string[]
}

export interface ExportResult {
  success: boolean
  boardId?: string
  boardUrl?: string
  tasksExported: number
  errors: string[]
  summary: {
    myTasks: number
    delegatedTasks: number
    withAssignments: number
    withNextSteps: number
  }
}

interface TrelloCard {
  name: string
  desc: string
  idList: string
  idLabels?: string[]
  due?: string
  customFieldItems?: Array<{
    idCustomField: string
    value: { text?: string; date?: string; number?: number }
  }>
}

export class TrelloExportService {
  private trello: any
  private boardId: string = ''
  private lists: { [key: string]: string } = {}
  private labels: { [key: string]: string } = {}
  private customFields: { [key: string]: string } = {}

  constructor() {
    if (!process.env.TRELLO_API_KEY || !process.env.TRELLO_TOKEN) {
      throw new Error('Trello API credentials not configured. Please set TRELLO_API_KEY and TRELLO_TOKEN environment variables.')
    }

    // Temporarily disabled Trello initialization
    // this.trello = new Trello({
    //   key: process.env.TRELLO_API_KEY,
    //   token: process.env.TRELLO_TOKEN
    // })
    throw new Error('Trello export temporarily disabled due to build issues')
  }

  /**
   * Main export function - exports Voice Memory tasks to Trello
   */
  async exportTasks(tasks: VoiceMemoryTask[], options: ExportOptions = {}): Promise<ExportResult> {
    console.log(`🚀 Starting Trello export for ${tasks.length} tasks...`)
    
    const result: ExportResult = {
      success: false,
      tasksExported: 0,
      errors: [],
      summary: {
        myTasks: 0,
        delegatedTasks: 0,
        withAssignments: 0,
        withNextSteps: 0
      }
    }

    try {
      // Filter tasks based on options
      const filteredTasks = this.filterTasks(tasks, options)
      console.log(`📋 Filtered to ${filteredTasks.length} tasks based on export options`)

      // Create board and setup structure
      const boardName = options.boardName || `Voice Memory Tasks - ${new Date().toLocaleDateString()}`
      await this.createBoard(boardName)
      await this.setupBoardStructure()

      result.boardId = this.boardId
      result.boardUrl = `https://trello.com/b/${this.boardId}`

      // Transform and export tasks in batches
      const trelloCards = this.transformTasksToTrelloCards(filteredTasks)
      await this.batchCreateCards(trelloCards)

      // Calculate summary
      result.summary = this.calculateSummary(filteredTasks)
      result.tasksExported = filteredTasks.length
      result.success = true

      console.log(`✅ Successfully exported ${result.tasksExported} tasks to Trello board: ${result.boardUrl}`)

    } catch (error) {
      console.error('❌ Trello export failed:', error)
      result.errors.push(error instanceof Error ? error.message : 'Unknown error occurred')
    }

    return result
  }

  /**
   * Create a new Trello board for Voice Memory tasks
   */
  async createBoard(name: string): Promise<void> {
    console.log(`📋 Creating Trello board: "${name}"`)
    
    try {
      const board = await this.trello.boards.create({
        name,
        desc: 'Tasks exported from Voice Memory - AI-powered voice note analysis',
        defaultLists: false,
        prefs_background: 'blue',
        prefs_permissionLevel: 'private'
      })

      this.boardId = board.id
      console.log(`✅ Board created successfully: ${board.url}`)
    } catch (error) {
      throw new Error(`Failed to create Trello board: ${error}`)
    }
  }

  /**
   * Setup board structure (lists, labels, custom fields)
   */
  async setupBoardStructure(): Promise<void> {
    console.log('🏗️ Setting up board structure...')

    try {
      // Create lists
      await this.createLists()
      
      // Create labels
      await this.createLabels()
      
      // Setup custom fields
      await this.setupCustomFields()

      console.log('✅ Board structure setup complete')
    } catch (error) {
      throw new Error(`Failed to setup board structure: ${error}`)
    }
  }

  /**
   * Create organized lists for different task types
   */
  private async createLists(): Promise<void> {
    const listDefinitions = [
      { name: '📋 My Tasks - To Do', key: 'myTasks' },
      { name: '👥 Delegated Tasks', key: 'delegatedTasks' },
      { name: '✅ Completed My Tasks', key: 'myTasksCompleted' },
      { name: '✅ Completed Delegated', key: 'delegatedCompleted' },
      { name: '📝 Task Backlog', key: 'backlog' }
    ]

    for (const listDef of listDefinitions) {
      const list = await this.trello.lists.create({
        idBoard: this.boardId,
        name: listDef.name,
        pos: 'bottom'
      })
      this.lists[listDef.key] = list.id
      console.log(`📝 Created list: ${listDef.name}`)
    }
  }

  /**
   * Create labels for task categorization and prioritization
   */
  private async createLabels(): Promise<void> {
    const labelDefinitions = [
      { name: 'my-task', color: 'blue' },
      { name: 'delegated', color: 'purple' },
      { name: 'urgent', color: 'red' },
      { name: 'normal', color: 'yellow' },
      { name: 'low', color: 'green' },
      { name: 'meeting', color: 'orange' },
      { name: 'project', color: 'lime' },
      { name: 'follow-up', color: 'pink' },
      { name: 'research', color: 'sky' }
    ]

    for (const labelDef of labelDefinitions) {
      const label = await this.trello.labels.create({
        idBoard: this.boardId,
        name: labelDef.name,
        color: labelDef.color
      })
      this.labels[labelDef.name] = label.id
      console.log(`🏷️ Created label: ${labelDef.name} (${labelDef.color})`)
    }
  }

  /**
   * Setup custom fields for Voice Memory metadata
   */
  private async setupCustomFields(): Promise<void> {
    const customFieldDefinitions = [
      { name: 'Voice Note ID', type: 'text', key: 'voiceNoteId' },
      { name: 'Recorded Date', type: 'date', key: 'recordedDate' },
      { name: 'Task Type', type: 'list', key: 'taskType', options: ['My Task', 'Delegated Task'] },
      { name: 'Assigned Person', type: 'text', key: 'assignedPerson' },
      { name: 'Primary Topic', type: 'text', key: 'primaryTopic' }
    ]

    for (const fieldDef of customFieldDefinitions) {
      try {
        const customField = await this.trello.customFields.create({
          idModel: this.boardId,
          modelType: 'board',
          name: fieldDef.name,
          type: fieldDef.type,
          pos: 'bottom',
          ...(fieldDef.options && {
            options: fieldDef.options.map((option, index) => ({
              value: { text: option },
              color: index === 0 ? 'blue' : 'purple',
              pos: index
            }))
          })
        })
        this.customFields[fieldDef.key] = customField.id
        console.log(`🔧 Created custom field: ${fieldDef.name}`)
      } catch (error) {
        console.warn(`⚠️ Could not create custom field ${fieldDef.name}:`, error)
      }
    }
  }

  /**
   * Transform Voice Memory tasks into Trello card format
   */
  private transformTasksToTrelloCards(tasks: VoiceMemoryTask[]): TrelloCard[] {
    return tasks.map(task => {
      const card: TrelloCard = {
        name: this.truncateTitle(task.description, 50),
        desc: this.generateCardDescription(task),
        idList: this.determineListId(task.type),
        idLabels: this.determineLabels(task),
        due: task.date
      }

      // Add custom fields if available
      if (Object.keys(this.customFields).length > 0) {
        card.customFieldItems = [
          { idCustomField: this.customFields.voiceNoteId, value: { text: task.noteId } },
          { idCustomField: this.customFields.recordedDate, value: { date: task.date } },
          { idCustomField: this.customFields.taskType, value: { text: task.type === 'myTasks' ? 'My Task' : 'Delegated Task' } },
          { idCustomField: this.customFields.assignedPerson, value: { text: task.assignedTo || '' } }
        ].filter(item => item.idCustomField) // Only include if custom field was created successfully
      }

      return card
    })
  }

  /**
   * Create cards in batches to respect rate limits
   */
  private async batchCreateCards(cards: TrelloCard[]): Promise<void> {
    const BATCH_SIZE = 80 // Under Trello's 300 requests/10 seconds limit
    const BATCH_DELAY = 11000 // 11 seconds between batches

    console.log(`📦 Creating ${cards.length} cards in batches of ${BATCH_SIZE}...`)

    for (let i = 0; i < cards.length; i += BATCH_SIZE) {
      const batch = cards.slice(i, i + BATCH_SIZE)
      console.log(`📋 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(cards.length / BATCH_SIZE)} (${batch.length} cards)`)

      // Create cards in parallel within the batch
      const batchPromises = batch.map(async (card, index) => {
        try {
          const createdCard = await this.trello.cards.create(card)
          console.log(`✅ Created card ${i + index + 1}/${cards.length}: ${card.name}`)
          return createdCard
        } catch (error) {
          console.error(`❌ Failed to create card: ${card.name}`, error)
          throw error
        }
      })

      await Promise.all(batchPromises)

      // Wait between batches to respect rate limits
      if (i + BATCH_SIZE < cards.length) {
        console.log(`⏳ Waiting ${BATCH_DELAY / 1000} seconds before next batch...`)
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY))
      }
    }

    console.log('✅ All cards created successfully')
  }

  /**
   * Helper methods
   */
  private filterTasks(tasks: VoiceMemoryTask[], options: ExportOptions): VoiceMemoryTask[] {
    let filtered = [...tasks]

    if (options.taskTypes && options.taskTypes.length > 0) {
      filtered = filtered.filter(task => options.taskTypes!.includes(task.type))
    }

    if (options.assignedTo && options.assignedTo.length > 0) {
      filtered = filtered.filter(task => 
        task.assignedTo && options.assignedTo!.includes(task.assignedTo)
      )
    }

    if (options.dateRange) {
      filtered = filtered.filter(task => {
        const taskDate = new Date(task.date)
        return taskDate >= options.dateRange!.start && taskDate <= options.dateRange!.end
      })
    }

    return filtered
  }

  private truncateTitle(title: string, maxLength: number): string {
    return title.length > maxLength ? title.substring(0, maxLength - 3) + '...' : title
  }

  private generateCardDescription(task: VoiceMemoryTask): string {
    return `## Task Details
**Type**: ${task.type === 'myTasks' ? 'My Task' : 'Delegated Task'}
**Recorded**: ${new Date(task.date).toLocaleDateString()}
**Source**: Voice Note #${task.noteId}

## Context
${task.noteContext || 'No context available'}

${task.type === 'delegatedTasks' && (task.assignedTo || task.nextSteps) ? `
## Assignment Details
${task.assignedTo ? `**Assigned To**: ${task.assignedTo}` : ''}
${task.nextSteps ? `**Next Steps**: ${task.nextSteps}` : ''}
` : ''}

## Voice Memory Metadata
**Task ID**: ${task.id}
**Original Date**: ${task.date}`
  }

  private determineListId(taskType: 'myTasks' | 'delegatedTasks'): string {
    return taskType === 'myTasks' ? this.lists.myTasks : this.lists.delegatedTasks
  }

  private determineLabels(task: VoiceMemoryTask): string[] {
    const labels: string[] = []

    // Task type label
    labels.push(task.type === 'myTasks' ? this.labels['my-task'] : this.labels['delegated'])

    // Priority based on sentiment could be added here
    labels.push(this.labels['normal']) // Default priority

    return labels.filter(Boolean)
  }

  private calculateSummary(tasks: VoiceMemoryTask[]) {
    return {
      myTasks: tasks.filter(t => t.type === 'myTasks').length,
      delegatedTasks: tasks.filter(t => t.type === 'delegatedTasks').length,
      withAssignments: tasks.filter(t => t.assignedTo).length,
      withNextSteps: tasks.filter(t => t.nextSteps).length
    }
  }
}