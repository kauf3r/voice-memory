# Voice Memory - Project Summary

**Version:** 1.1.0
**Last Updated:** January 2026
**Status:** Production Ready

## Overview

Voice Memory is an AI-powered voice note application that transforms audio recordings into actionable insights. It uses OpenAI Whisper for transcription and GPT-4 for intelligent analysis, extracting tasks, priorities, and draft messages from your voice notes.

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 16.0.10 (App Router) |
| **Language** | TypeScript 5.3 |
| **Database** | Supabase (PostgreSQL + Auth + Storage) |
| **AI/ML** | OpenAI Whisper (transcription), GPT-4o (analysis) |
| **Styling** | Tailwind CSS 3.4, Radix UI components |
| **Deployment** | Vercel (Pro plan for extended timeouts) |
| **Testing** | Jest, Playwright, Testing Library |

## Core Features

### 1. Voice Processing Pipeline
```
Upload → Transcribe (Whisper) → Analyze (GPT-4) → Store → Display
```

- **Signed URL uploads** - Bypass Vercel body limits for large files
- **Direct fetch API calls** - Reliable OpenAI integration in serverless
- **M4A/MP3/WAV support** - Automatic format detection and handling
- **5-minute processing timeout** - Handles long recordings

### 2. AI Analysis (ADHD-Friendly)

The analysis extracts 7 key elements:

| Field | Description |
|-------|-------------|
| `summary` | One-sentence overview |
| `mood` | positive / neutral / negative |
| `topic` | Primary focus area (2-4 words) |
| `theOneThing` | Single most important priority |
| `tasks` | Actionable items with NOW/SOON/LATER urgency |
| `draftMessages` | Ready-to-send communications |
| `people` | Relationship tracking |

### 3. Task Management

- **Urgency System:** NOW / SOON / LATER (not traditional priority)
- **Domain Classification:** WORK / PERS / PROJ
- **Pin/Unpin System:** Keep important tasks visible
- **Completion Tracking:** Real-time status updates

### 4. Knowledge Base

- Aggregated insights across all notes
- Export functionality
- Cross-reference tracking between notes

## Architecture

```
app/
├── api/                    # API Routes
│   ├── process/           # Audio processing (5-min timeout)
│   ├── upload/            # Signed URL upload flow
│   │   ├── signed-url/    # Generate upload URL
│   │   └── create-note/   # Create note after upload
│   ├── notes/             # CRUD operations
│   ├── tasks/             # Task management
│   └── knowledge/         # Knowledge base
├── components/            # React components (51 files)
├── hooks/                 # Custom React hooks
└── services/              # Client-side services

lib/
├── openai.ts              # OpenAI integration (direct fetch)
├── analysis.ts            # Analysis prompt definition
├── processing/            # Processing service layer
│   ├── ProcessingService.ts
│   ├── AudioProcessorService.ts
│   ├── AnalysisProcessorService.ts
│   └── AudioFormatNormalizationService.ts
├── services/              # Database services
├── cache/                 # Caching layer
└── config/                # Configuration management
```

## Key Implementation Details

### OpenAI Integration (`lib/openai.ts`)

Uses **direct fetch** instead of SDK for serverless reliability:

```typescript
// Whisper: 5-minute timeout for large files
async function transcribeWithDirectFetch(file: File) {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), 300000)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
    signal: controller.signal,
  })
}

// GPT-4: 3-minute timeout for analysis
async function analyzeWithDirectFetch(prompt, systemPrompt) {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), 180000)

  const response = await fetch('https://api.openai.com/v1/chat/completions', { ... })
}
```

### Upload Flow

Two-step signed URL flow to bypass Vercel's 4.5MB body limit:

1. `POST /api/upload/signed-url` → Get Supabase signed URL
2. `PUT` directly to Supabase Storage (client-side)
3. `POST /api/upload/create-note` → Create database record

### Analysis Prompt

ADHD-optimized extraction focusing on actionable outcomes:

- **Task titles** must start with action verbs
- **Urgency** based on explicit signals (deadlines, stress, blocking)
- **The One Thing** identifies single top priority
- **Draft messages** ready to copy-paste

## Recent Achievements (January 2026)

| Date | Change | Impact |
|------|--------|--------|
| Jan 4 | Direct fetch for OpenAI | Fixed connection errors in serverless |
| Jan 4 | Signed URL uploads | Bypass Vercel 4.5MB body limit |
| Jan 3 | 5-minute processing timeout | Handle 16+ minute recordings |
| Jan 3 | Cache invalidation strategy | Real-time updates without stale data |
| Jan 1 | Adaptive polling (5s → 30s) | Reduced server load |
| Jan 1 | List virtualization | Smooth scrolling for large note lists |

## Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=

# Optional
OPENAI_GPT_MODEL=gpt-4o          # Default: gpt-4o
OPENAI_WHISPER_MODEL=whisper-1   # Default: whisper-1
OPENAI_RETRY_ATTEMPTS=5          # Default: 5
```

## Deployment Requirements

- **Vercel Pro** - Required for 300s function timeout
- **Supabase** - Database, Auth, and Storage
- **OpenAI API** - Whisper and GPT-4 access

### Vercel Configuration (`vercel.json`)

```json
{
  "functions": {
    "app/api/process/**/*.ts": {
      "maxDuration": 300
    }
  },
  "regions": ["iad1"]
}
```

## Scripts

```bash
npm run dev              # Development server
npm run build            # Production build
npm run test             # Run Jest tests
npm run test:e2e         # Run Playwright tests
npm run typecheck        # TypeScript validation
npm run diagnose-stuck   # Debug stuck notes
npm run fix-stuck-notes  # Reset stuck processing
```

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `notes` | Voice notes with transcription & analysis |
| `task_pins` | Pinned task tracking |
| `task_completions` | Task completion status |
| `task_states` | Combined task state view |
| `project_knowledge` | Aggregated knowledge base |

## Known Limitations

1. **File Size:** ~25MB max (OpenAI Whisper limit)
2. **Duration:** ~2 hours max per recording
3. **Language:** English only (configurable in prompt)
4. **Timeout:** 5 minutes max processing time (Vercel Pro)

## Documentation

- `CLAUDE.md` - Development guidelines for AI assistants
- `docs/solutions/` - Problem solutions and workarounds
- `docs/OPENAI_SERVERLESS_*.md` - OpenAI integration guides

## Contributing

1. Follow existing patterns in codebase
2. Use TypeScript with strict types
3. Write tests for new features
4. Run `npm run precommit` before committing
