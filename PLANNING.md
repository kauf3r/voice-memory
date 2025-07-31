# PLANNING.md - Voice Memory Project Planning (Simplified)

## Vision

### Product Vision Statement
Voice Memory transforms voice recordings into actionable insights through a sophisticated 7-point AI analysis framework, delivered through a beautifully simple interface that respects users' time and intelligence.

### Core Values
- **Sophisticated Analysis**: Extract 7 categories of insights from every note
- **Radical Simplicity**: Complex analysis, simple interface
- **Batch Intelligence**: Process efficiently, deliver comprehensively
- **Progressive Knowledge**: Build connections across time

## Architecture

### Simplified System Architecture

```
┌─────────────────────────────────────────────┐
│              User Device                    │
│         (Upload audio files)                │
└──────────────────┬──────────────────────────┘
                   │
┌─────────────────────────────────────────────┐
│            Vercel Edge                      │
│         (Next.js Application)               │
│  ┌─────────────────────────────────────┐   │
│  │   • Upload Handler                   │   │
│  │   • Dashboard UI                     │   │
│  │   • Analysis Display                 │   │
│  │   • Search Interface                 │   │
│  └─────────────────────────────────────┘   │
└──────────────────┬──────────────────────────┘
                   │
┌─────────────────────────────────────────────┐
│            Supabase Platform                │
│  ┌──────────────┐  ┌───────────────────┐   │
│  │ PostgreSQL   │  │   File Storage    │   │
│  │  + Auth      │  │   (Audio Files)   │   │
│  └──────────────┘  └───────────────────┘   │
└──────────────────┬──────────────────────────┘
                   │
┌─────────────────────────────────────────────┐
│              OpenAI APIs                    │
│  ┌──────────────┐  ┌───────────────────┐   │
│  │   Whisper    │  │     GPT-4         │   │
│  │(Transcription)│ │   (Analysis)      │   │
│  └──────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────┘
```

### Data Flow

1. **Upload**: Audio → Supabase Storage → Queue for processing
2. **Process**: Batch job → Whisper → GPT-4 → Store analysis
3. **Display**: Fetch notes → Render cards → Expand for details
4. **Search**: Query → PostgreSQL full-text → Return results

## Technology Stack

### Core Stack
- **Framework**: Next.js 14 (App Router) - Full-stack React framework
- **Database**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Styling**: Tailwind CSS (utility-first, minimal custom CSS)
- **Language**: TypeScript (type safety without complexity)
- **AI**: OpenAI (Whisper for transcription, GPT-4 for analysis)
- **Hosting**: Vercel (zero-config deployment)

### Key Dependencies
```json
{
  "next": "14.1.0",
  "@supabase/supabase-js": "2.39.0",
  "openai": "4.24.0",
  "tailwindcss": "3.4.0",
  "typescript": "5.3.0",
  "zod": "3.22.0",
  "date-fns": "3.0.0"
}
```

### Development Tools
- **Package Manager**: pnpm (fast, efficient)
- **Linting**: ESLint (Next.js defaults)
- **Formatting**: Prettier
- **Git Hooks**: Simple pre-commit checks

## Required Tools List

### Essential Accounts
1. **GitHub** - Code repository
2. **Vercel** - Hosting (free tier)
3. **Supabase** - Database/Auth/Storage (free tier)
4. **OpenAI** - AI APIs (pay-as-you-go)

### Development Setup
```bash
# Install required tools
brew install node
npm install -g pnpm
npm install -g vercel

# Clone and setup
git clone [repository]
cd voice-memory
pnpm install
cp .env.example .env.local
# Add your API keys to .env.local
```

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_KEY=[service-key]

# OpenAI
OPENAI_API_KEY=sk-[your-key]

# App Config
NEXT_PUBLIC_APP_URL=http://localhost:3000
BATCH_PROCESS_INTERVAL=3600000 # 1 hour in ms
```

## Development Phases

### Week 1: Foundation
- Set up Next.js with TypeScript
- Configure Supabase (auth, database, storage)
- Create basic UI layout
- Implement file upload

### Week 2: Core Processing
- Integrate Whisper API
- Implement GPT-4 analysis prompt
- Create batch processing system
- Store results in database

### Week 3: User Experience
- Build analysis display components
- Add search functionality
- Create Project Knowledge view
- Implement message drafting

### Week 4: Polish & Deploy
- Error handling and retries
- Performance optimization
- Mobile responsiveness
- Deploy to production

## Cost Analysis

### Monthly Costs (100 users, 10 notes/day each)
- **Vercel**: $0 (free tier)
- **Supabase**: $0 (free tier covers this)
- **OpenAI Whisper**: ~$18 (1000 notes × 5 min × $0.006/min)
- **OpenAI GPT-4**: ~$30 (1000 analyses × ~1000 tokens × $0.03/1K)
- **Total**: ~$48/month

### Cost Optimization
- Batch processing reduces API overhead
- Cache analyses to avoid reprocessing
- Compress audio files after processing
- Use GPT-4-turbo for better pricing

## Security & Privacy

### Data Protection
- All data encrypted at rest (Supabase)
- Row Level Security for user isolation
- Signed URLs for audio files (expire after 1 hour)
- No third-party analytics

### Authentication
- Supabase Auth with magic links
- Optional OAuth (Google, Apple)
- Session management handled by Supabase

## Performance Targets

- **Upload Speed**: <2 seconds for 10MB file
- **Processing Time**: <30 seconds per 5-minute audio
- **Dashboard Load**: <1 second
- **Search Response**: <500ms

## Monitoring & Analytics

### Application Monitoring
- Vercel Analytics (Core Web Vitals)
- Supabase Dashboard (Database metrics)
- Custom logging for processing pipeline

### Business Metrics
- Daily active users
- Notes processed per day
- Average analysis quality (user feedback)
- Search success rate

## Risk Mitigation

### Technical Risks
- **OpenAI Downtime**: Queue system with retries
- **Cost Overrun**: User quotas, monitoring alerts
- **Data Loss**: Automated backups, soft deletes

### Product Risks
- **Low Adoption**: Quick iteration based on feedback
- **Feature Creep**: Strict MVP scope adherence
- **Complexity**: Regular simplification reviews

## Success Criteria

### MVP Success Metrics
- 50 beta users processing 5+ notes/week
- 90% successful processing rate
- <5 second time to first insight
- 4.5+ user satisfaction rating

### Long-term Vision
- 10,000 active users
- 1M notes processed
- Team collaboration features
- API for integrations

---

This simplified planning focuses on delivering sophisticated analysis through the simplest possible implementation. Every technical decision prioritizes shipping quickly while maintaining quality.