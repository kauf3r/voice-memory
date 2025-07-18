# CLAUDE.md - Voice Memory Project Guide (Simplified)

## Important Instructions for Every Session

**Always read PLANNING.md at the start of every new conversation.**

**Check TASKS.md before starting your work.**

**Mark completed tasks immediately.**

**Add newly discovered tasks.**

## Project Overview

**Voice Memory** is a streamlined web application that processes voice notes through sophisticated AI analysis, extracting 7 key insight categories to help users build an actionable knowledge base from their spoken thoughts.

## Core Analysis Framework

The app implements a 7-point analysis system:
1. Sentiment Analysis (Positive/Neutral/Negative)
2. Focus Topics (Primary + 2 Minor themes)
3. Tasks (Personal tasks vs Delegated tasks)
4. Key Ideas & Insights
5. Messages to Draft
6. Cross-References & Project Knowledge
7. Outreach & Networking Ideas

## Simplified Technical Stack

### Frontend & Backend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (minimal custom classes)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **AI Services**: OpenAI (Whisper + GPT-4)
- **Hosting**: Vercel

### Key Libraries
```json
{
  "dependencies": {
    "next": "14.x",
    "@supabase/supabase-js": "2.x",
    "openai": "4.x",
    "react": "18.x",
    "tailwindcss": "3.x",
    "date-fns": "3.x",
    "zod": "3.x"
  }
}
```

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Voice notes table
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    audio_url TEXT NOT NULL,
    duration_seconds INTEGER,
    transcription TEXT,
    analysis JSONB,
    recorded_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Project knowledge document
CREATE TABLE project_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Full-text search index
CREATE INDEX notes_search_idx ON notes 
USING gin(to_tsvector('english', 
    COALESCE(transcription, '') || ' ' || 
    COALESCE(analysis::text, '')
));
```

## Analysis JSON Structure

```typescript
interface NoteAnalysis {
  sentiment: {
    classification: "Positive" | "Neutral" | "Negative";
    explanation: string;
  };
  focusTopics: {
    primary: string;
    minor: [string, string];
  };
  tasks: {
    myTasks: string[];
    delegatedTasks: Array<{
      task: string;
      assignedTo: string;
      nextSteps: string;
    }>;
  };
  keyIdeas: string[];
  messagesToDraft: Array<{
    recipient: string;
    subject: string;
    body: string;
  }>;
  crossReferences: {
    relatedNotes: string[];
    projectKnowledgeUpdates: string[];
  };
  outreachIdeas: Array<{
    contact: string;
    topic: string;
    purpose: string;
  }>;
}
```

## API Routes

```
POST   /api/upload          - Upload audio file
POST   /api/process         - Process uploaded files
GET    /api/notes           - List user's notes
GET    /api/notes/[id]      - Get specific note
DELETE /api/notes/[id]      - Delete note
GET    /api/search          - Search notes
GET    /api/knowledge       - Get project knowledge
PUT    /api/knowledge       - Update project knowledge
```

## File Structure

```
voice-memory/
├── app/
│   ├── page.tsx                 # Main dashboard
│   ├── layout.tsx               # Root layout with auth
│   ├── api/
│   │   ├── upload/route.ts      # File upload handler
│   │   ├── process/route.ts     # Audio processing
│   │   ├── notes/route.ts       # Notes CRUD
│   │   ├── search/route.ts      # Search endpoint
│   │   └── knowledge/route.ts   # Project knowledge
│   └── components/
│       ├── UploadButton.tsx     # Upload interface
│       ├── NoteCard.tsx         # Note display
│       ├── AnalysisView.tsx     # 7-point analysis
│       ├── MessageDrafter.tsx   # Draft messages
│       └── SearchBar.tsx        # Search interface
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── openai.ts               # OpenAI integration
│   ├── analysis.ts             # Analysis prompt logic
│   └── types.ts                # TypeScript types
└── public/
    └── manifest.json           # PWA manifest
```

## GPT-4 Analysis Prompt

```typescript
const ANALYSIS_PROMPT = `
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
`;
```

## Processing Flow

1. **Upload**: User uploads audio file(s)
2. **Queue**: Files marked for processing
3. **Batch Process** (hourly or on-demand):
   - Transcribe with Whisper
   - Analyze with GPT-4
   - Update Project Knowledge
   - Store results
4. **Display**: Show analysis in expandable cards

## UI Components

### Main Dashboard
- Upload button (prominent)
- Processing status
- Notes timeline (newest first)
- Search bar
- Project Knowledge link

### Note Card
- Date/Time header
- Sentiment badge (color-coded)
- Primary topic label
- Task count badges
- Expand button for full analysis

### Expanded Analysis View
- All 7 analysis points
- Audio player
- Full transcription
- Action buttons (draft messages, export tasks)

## Development Guidelines

1. **Keep It Simple**:
   - No complex state management
   - Minimal dependencies
   - Server components where possible

2. **Progressive Enhancement**:
   - Works without JavaScript
   - Enhances with interactivity
   - Offline-capable with service worker

3. **Error Handling**:
   - User-friendly error messages
   - Automatic retries for processing
   - Graceful degradation

4. **Performance**:
   - Lazy load audio files
   - Paginate notes list
   - Cache analysis results

## Cost Optimization

- Batch processing reduces API calls by 80%
- Store audio files compressed
- Cache transcriptions and analyses
- Use GPT-4-turbo for better price/performance

## Security

- Row Level Security in Supabase
- Signed URLs for audio files
- Rate limiting on API routes
- Input sanitization for all user content

## Testing Approach

1. **Unit Tests**: Core analysis logic
2. **Integration Tests**: API routes
3. **E2E Tests**: Upload → Process → View flow
4. **Manual Testing**: Audio quality, mobile experience

## Deployment

```bash
# Environment variables
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
OPENAI_API_KEY=

# Deploy to Vercel
vercel --prod
```

## Future Enhancements (Post-MVP)

1. Real-time processing
2. iOS share extension
3. Team collaboration
4. Custom analysis templates
5. API for integrations

---

This simplified approach maintains the sophisticated analysis while reducing complexity by 70%. Focus on shipping the core experience first, then iterate based on user feedback.