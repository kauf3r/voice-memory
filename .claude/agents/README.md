# Claude Code Subagents for Voice Memory

This directory contains specialized AI subagents designed to accelerate development and improve code quality for the Voice Memory project.

## 🤖 Available Subagents

### 1. `voice-transcription-optimizer`
Expert in optimizing the voice recording and transcription pipeline.

**Specializes in:**
- Audio file processing and validation
- OpenAI Whisper API optimization
- Transcription accuracy improvements
- Cost and performance optimization
- Error handling and recovery

**Use when:**
- Working on audio upload features
- Optimizing transcription quality
- Reducing API costs
- Implementing new audio formats
- Debugging transcription issues

**Example usage:**
```
Task: "Help me implement audio streaming for real-time transcription"
Subagent: voice-transcription-optimizer will handle this
```

### 2. `supabase-expert`
Database and real-time features expert for all Supabase-related tasks.

**Specializes in:**
- Database schema design
- Row Level Security (RLS) policies
- Real-time subscriptions
- Query optimization
- Authentication flows

**Use when:**
- Creating new database tables
- Writing RLS policies
- Implementing real-time features
- Optimizing slow queries
- Debugging authentication issues

**Example usage:**
```
Task: "Create an efficient query for fetching user's notes with pagination"
Subagent: supabase-expert will optimize this
```

### 3. `ai-analysis-enhancer`
Expert in improving the 7-point AI analysis system.

**Specializes in:**
- Prompt engineering for GPT-4
- Analysis quality improvements
- Token usage optimization
- Insight extraction enhancement
- Custom analysis features

**Use when:**
- Improving analysis accuracy
- Adding new analysis categories
- Optimizing GPT-4 prompts
- Reducing API costs
- Implementing analysis features

**Example usage:**
```
Task: "Improve task extraction to better identify action items"
Subagent: ai-analysis-enhancer will enhance this
```

### 4. `performance-monitor`
Full-stack performance optimization specialist.

**Specializes in:**
- Next.js 15 optimization
- React performance tuning
- Database query optimization
- Bundle size reduction
- Performance monitoring

**Use when:**
- Addressing slow page loads
- Optimizing React components
- Reducing bundle sizes
- Implementing caching
- Setting up monitoring

**Example usage:**
```
Task: "The notes list is slow with 1000+ items"
Subagent: performance-monitor will optimize this
```

### 5. `test-automation`
Testing expert for comprehensive test coverage.

**Specializes in:**
- Unit testing with Jest
- React Testing Library
- E2E testing with Playwright
- Test strategy and coverage
- CI/CD integration

**Use when:**
- Writing new tests
- Improving test coverage
- Setting up E2E tests
- Debugging failing tests
- Implementing TDD

**Example usage:**
```
Task: "Write tests for the new task pinning feature"
Subagent: test-automation will create comprehensive tests
```

## 🚀 How to Use Subagents

### Automatic Invocation
Claude will automatically select the appropriate subagent based on your task:

```
You: "I need to optimize the database queries for the knowledge page"
Claude: [Automatically uses supabase-expert]
```

### Explicit Invocation
You can also explicitly request a specific subagent:

```
You: "Use the ai-analysis-enhancer to help me improve sentiment analysis"
```

### Multiple Subagents
Complex tasks may involve multiple subagents:

```
You: "Implement a new feature for batch audio processing with tests"
Claude: [May use voice-transcription-optimizer + test-automation]
```

## 💡 Best Practices

1. **Let Claude Choose**: Usually, Claude will automatically select the right subagent
2. **Be Specific**: Provide clear context about what you're trying to achieve
3. **Chain Subagents**: For complex features, multiple subagents may collaborate
4. **Review Output**: Subagents provide specialized advice - review and adapt as needed

## 📊 Subagent Selection Guide

| Task Type | Recommended Subagent |
|-----------|---------------------|
| Audio/transcription issues | `voice-transcription-optimizer` |
| Database/auth problems | `supabase-expert` |
| AI analysis improvements | `ai-analysis-enhancer` |
| Performance issues | `performance-monitor` |
| Writing tests | `test-automation` |

## 🔧 Configuration

Subagents are configured with specific tools and system prompts optimized for their domains. Each has access to:
- Read/Write/Edit capabilities
- Specialized tool access
- Domain-specific knowledge
- Best practices and patterns

## 📈 Benefits

Using these specialized subagents will:
- **Speed up development** by providing expert-level guidance
- **Improve code quality** with domain-specific best practices
- **Reduce bugs** through proper implementation patterns
- **Optimize performance** with specialized knowledge
- **Save time** by avoiding common pitfalls

## 🔄 Continuous Improvement

These subagents are continuously updated based on:
- Project evolution
- New best practices
- Performance learnings
- User feedback

Feel free to suggest improvements or new subagents that would help your development workflow!