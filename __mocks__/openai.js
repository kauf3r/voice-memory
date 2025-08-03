// Mock for OpenAI SDK

const mockTranscription = {
  text: 'This is a mock transcription of the audio file.',
}

const mockChatCompletion = {
  id: 'chatcmpl-mock-id',
  object: 'chat.completion',
  created: Date.now() / 1000,
  model: 'gpt-4-turbo-preview',
  choices: [{
    index: 0,
    message: {
      role: 'assistant',
      content: JSON.stringify({
        sentiment: {
          classification: 'Positive',
          explanation: 'This is a mock positive sentiment analysis.'
        },
        focusTopics: {
          primary: 'Mock Topic',
          minor: ['Subtopic 1', 'Subtopic 2']
        },
        tasks: {
          myTasks: ['Mock task 1', 'Mock task 2'],
          delegatedTasks: [{
            task: 'Delegated mock task',
            assignedTo: 'Team Member',
            nextSteps: 'Follow up next week'
          }]
        },
        keyIdeas: ['Mock idea 1', 'Mock idea 2'],
        messagesToDraft: [{
          recipient: 'colleague@example.com',
          subject: 'Mock subject',
          body: 'Mock message body'
        }],
        crossReferences: {
          relatedNotes: [],
          projectKnowledgeUpdates: ['Updated project understanding']
        },
        outreachIdeas: [{
          contact: 'Potential Contact',
          topic: 'Collaboration',
          purpose: 'Explore partnership opportunities'
        }],
        structuredData: {
          dates: ['2024-01-20'],
          times: ['2:00 PM'],
          locations: ['Conference Room A'],
          numbers: ['$10,000', '5 people'],
          people: ['John Doe', 'Jane Smith']
        },
        recordingContext: {
          recordedAt: '2024-01-19T14:00:00Z',
          extractedDate: '2024-01-19',
          timeReferences: ['this afternoon', 'next week']
        }
      })
    },
    finish_reason: 'stop'
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 200,
    total_tokens: 300
  }
}

const mockOpenAI = {
  audio: {
    transcriptions: {
      create: jest.fn().mockResolvedValue(mockTranscription),
    },
  },
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue(mockChatCompletion),
    },
  },
}

// Mock the OpenAI class constructor
const OpenAI = jest.fn().mockImplementation(() => mockOpenAI)

// Static methods and properties
OpenAI.mockTranscription = mockTranscription
OpenAI.mockChatCompletion = mockChatCompletion
OpenAI.mockClient = mockOpenAI

// Export configurations for different test scenarios
OpenAI.configureMock = (config) => {
  if (config.transcriptionError) {
    mockOpenAI.audio.transcriptions.create.mockRejectedValue(new Error(config.transcriptionError))
  } else if (config.transcriptionText) {
    mockOpenAI.audio.transcriptions.create.mockResolvedValue({ text: config.transcriptionText })
  } else {
    mockOpenAI.audio.transcriptions.create.mockResolvedValue(mockTranscription)
  }

  if (config.chatError) {
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error(config.chatError))
  } else if (config.chatResponse) {
    const response = {
      ...mockChatCompletion,
      choices: [{
        ...mockChatCompletion.choices[0],
        message: {
          ...mockChatCompletion.choices[0].message,
          content: typeof config.chatResponse === 'string' 
            ? config.chatResponse 
            : JSON.stringify(config.chatResponse)
        }
      }]
    }
    mockOpenAI.chat.completions.create.mockResolvedValue(response)
  } else {
    mockOpenAI.chat.completions.create.mockResolvedValue(mockChatCompletion)
  }

  return mockOpenAI
}

// Reset mock to default state
OpenAI.resetMock = () => {
  jest.clearAllMocks()
  mockOpenAI.audio.transcriptions.create.mockResolvedValue(mockTranscription)
  mockOpenAI.chat.completions.create.mockResolvedValue(mockChatCompletion)
}

export default OpenAI