# Voice Memory - Product Requirements Document

Version: 1.0  
Date: January 29, 2025

## Product overview

Voice Memory is an AI-powered voice note transcription and analysis platform that transforms audio recordings into actionable insights. The application enables users to upload voice recordings in various formats, automatically transcribes them using OpenAI's Whisper model, and generates comprehensive analyses including summaries, key insights, action items, and sentiment analysis. The platform aggregates knowledge across all notes to provide a searchable, exportable knowledge base with integrated task management capabilities.

## Goals

### Business goals
- Provide a seamless voice-to-insight platform that reduces friction in capturing and organizing thoughts
- Establish a subscription-ready SaaS product with clear value proposition for knowledge workers
- Build a scalable platform capable of handling enterprise-level usage patterns
- Create revenue opportunities through premium features and API access

### User goals
- Capture thoughts and ideas quickly through voice recordings without manual note-taking
- Transform unstructured voice notes into organized, actionable information
- Build a searchable knowledge base from accumulated voice recordings
- Track and manage tasks extracted from voice notes
- Access insights and tasks across devices through web interface

### Non-goals
- Real-time voice transcription or live recording features
- Native mobile applications (initial release is web-only)
- Multi-language support (English-only for initial release)
- Team collaboration features (single-user focus initially)
- Integration with third-party voice assistants

## User personas

### Primary persona: Knowledge Worker "Sarah"
- **Role**: Product Manager at a tech company
- **Age**: 32
- **Tech savvy**: High
- **Pain points**: Loses track of ideas from meetings, struggles to organize thoughts from various conversations
- **Goals**: Capture meeting insights, track action items, build knowledge repository
- **Usage pattern**: Records 5-10 voice notes daily, reviews weekly for insights

### Secondary persona: Creative Professional "Alex"
- **Role**: Freelance consultant and writer
- **Age**: 28
- **Tech savvy**: Medium
- **Pain points**: Ideas come at inconvenient times, difficult to organize project thoughts
- **Goals**: Capture creative ideas, track client tasks, organize project knowledge
- **Usage pattern**: Records sporadically throughout day, heavy analysis user

### Tertiary persona: Executive "Michael"
- **Role**: Startup CEO
- **Age**: 45
- **Tech savvy**: Medium
- **Pain points**: Too many meetings, needs to delegate effectively, track commitments
- **Goals**: Capture meeting outcomes, delegate tasks, track strategic initiatives
- **Usage pattern**: Records after each meeting, focuses on task delegation

### Role-based access
- **Standard User**: Full access to personal notes, analysis, and export features
- **Premium User** (future): Extended quotas, priority processing, advanced export options
- **Admin** (internal): System monitoring, user management, processing queue oversight

## Functional requirements

### High priority (P0)
1. **Audio Upload**: Support for multiple audio formats (MP3, M4A, WAV, AAC, OGG) and video formats with audio extraction (MP4, MOV, AVI, WebM)
2. **Automatic Transcription**: Convert audio to text using OpenAI Whisper API
3. **AI Analysis**: Generate 7-point analysis framework for each note
4. **Search Functionality**: Full-text search across transcriptions and analyses
5. **Authentication**: Secure magic link authentication via Supabase
6. **Task Management**: Extract, track, and complete tasks from voice notes

### Medium priority (P1)
1. **Knowledge Aggregation**: Compile insights across all notes into unified knowledge base
2. **Export Capabilities**: Export data in JSON format and Trello integration
3. **Batch Processing**: Handle multiple file uploads with queuing system
4. **Quota Management**: Track and limit usage per user
5. **Processing Status**: Real-time updates on transcription/analysis progress

### Low priority (P2)
1. **Sentiment Tracking**: Visualize sentiment trends over time
2. **Contact Management**: Track people mentioned across notes
3. **Topic Clustering**: Group related notes by extracted topics
4. **Timeline View**: Chronological view of all insights and events
5. **Advanced Filtering**: Filter notes by date, sentiment, topics, or contacts

## User experience

### Entry points
1. **Direct URL Access**: Users navigate to the web application URL
2. **Email Magic Link**: Authentication link sent to user's email
3. **Bookmark/PWA**: Users can save as bookmark or progressive web app

### Core experience
1. **Upload Flow**:
   - Drag-and-drop or click to upload audio files
   - Support for multiple file selection
   - Progress indication during upload
   - Immediate feedback on upload success/failure

2. **Processing Flow**:
   - Automatic queuing of uploaded files
   - Real-time status updates (pending → processing → completed)
   - Error handling with retry capabilities
   - Background processing allows continued app usage

3. **Analysis Review**:
   - Card-based layout showing transcription and analysis
   - Expandable sections for detailed insights
   - Visual indicators for sentiment and key metrics
   - Quick actions for task management

4. **Knowledge Base**:
   - Tabbed interface for different insight categories
   - Aggregated statistics and trends
   - Interactive filtering and search
   - Export options readily accessible

### Advanced features
- **Bulk Operations**: Select multiple notes for batch actions
- **Smart Search**: Search with filters and boolean operators
- **Task Workflows**: Mark tasks complete with notes and assignee tracking
- **Trello Export**: Configure board and list mappings for task export

### UI/UX highlights
- Clean, minimal interface with focus on content
- Responsive design works on desktop and tablet
- Loading states and progress indicators throughout
- Consistent color coding for sentiment and categories
- Accessibility considerations with proper ARIA labels

## Narrative

Sarah, a product manager, finishes her third meeting of the day. Instead of frantically typing notes or letting insights slip away, she pulls out her phone and records a 3-minute voice memo summarizing key decisions, her concerns about the timeline, and action items for her team. Within minutes, Voice Memory has transcribed her recording and extracted seven key insights: a summary, three main takeaways about the product roadmap, two tasks she needs to complete, a draft email to engineering about timeline concerns, and identified her slightly negative sentiment about project risks. Later that evening, Sarah reviews her accumulated insights from the week, exports her tasks to Trello, and uses the AI-generated email draft as a starting point for her communication to the team. Her voice has become her most efficient knowledge capture tool.

## Success metrics

### User-centric metrics
- **Activation Rate**: Percentage of users who upload and process first voice note
- **Retention Rate**: Weekly active users who return following week
- **Feature Adoption**: Percentage using search, export, and task features
- **Processing Success Rate**: Successful transcriptions/analyses vs failures
- **Time to Insight**: Average time from upload to completed analysis

### Business metrics
- **Monthly Active Users**: Unique users processing at least one note
- **Notes Processed**: Total voice notes processed per month
- **Conversion Rate**: Free to paid tier conversion (when implemented)
- **API Usage**: Costs and efficiency of OpenAI API usage
- **Storage Utilization**: Average storage per user and growth rate

### Technical metrics
- **Processing Time**: P50/P95/P99 latency for transcription and analysis
- **Error Rate**: Percentage of failed processing attempts
- **Queue Depth**: Average and peak processing queue sizes
- **System Uptime**: Application availability percentage
- **API Response Time**: Frontend API endpoint performance

## Technical considerations

### Integration points
1. **Supabase**:
   - PostgreSQL database for all application data
   - Authentication service for magic link auth
   - Storage service for audio file hosting
   - Real-time subscriptions for live updates

2. **OpenAI API**:
   - Whisper API for audio transcription
   - GPT-4 for content analysis and insight extraction
   - Rate limiting and retry logic required

3. **Vercel**:
   - Hosting platform for Next.js application
   - Serverless functions for API routes
   - Edge caching for static assets

4. **Trello API**:
   - OAuth integration for authentication
   - Board and list creation for task export
   - Card creation with descriptions and due dates

### Data storage/privacy
- **Audio Files**: Stored in Supabase Storage with user-scoped access
- **Transcriptions**: Stored encrypted in PostgreSQL database
- **User Data**: Row-level security ensures users only access own data
- **Data Retention**: Audio files retained indefinitely unless deleted by user
- **GDPR Compliance**: User data export and deletion capabilities required

### Scalability/performance
- **Concurrent Processing**: Queue system prevents API overload
- **Caching Strategy**: Knowledge base aggregations cached for performance
- **Database Indexing**: Full-text search indexes on transcriptions
- **Rate Limiting**: Per-user quotas prevent abuse
- **Circuit Breaker**: Automatic fallback when external services fail

### Potential challenges
1. **Audio Quality**: Poor recordings may result in transcription errors
2. **Processing Costs**: OpenAI API costs scale with usage
3. **Long Audio Files**: Large files require chunking strategies
4. **Real-time Updates**: WebSocket connections for live status updates
5. **Mobile Experience**: Web-based solution must work well on mobile browsers

## Milestones & sequencing

### Project estimate
- **Timeline**: 12-16 weeks for MVP
- **Team size**: 2-3 engineers, 1 designer, 1 product manager

### Suggested phases

**Phase 1: Core Infrastructure (Weeks 1-3)**
- Set up development environment and CI/CD
- Implement authentication system
- Create basic upload and storage functionality
- Design and implement database schema

**Phase 2: Processing Pipeline (Weeks 4-6)**
- Integrate OpenAI Whisper API
- Build transcription processing queue
- Implement GPT-4 analysis pipeline
- Add error handling and retry logic

**Phase 3: User Interface (Weeks 7-9)**
- Design and implement upload interface
- Create note cards with transcription display
- Build analysis visualization components
- Add search and filtering capabilities

**Phase 4: Knowledge Features (Weeks 10-12)**
- Aggregate insights across notes
- Implement task extraction and management
- Create knowledge base views
- Add export functionality

**Phase 5: Polish & Launch Prep (Weeks 13-14)**
- Performance optimization
- Security audit and fixes
- User acceptance testing
- Documentation and deployment

**Phase 6: Post-Launch (Weeks 15-16)**
- Monitor system performance
- Fix critical bugs
- Gather user feedback
- Plan next feature iterations

## User stories

### Authentication & Access
**US-001** - User Registration via Magic Link  
As a new user, I want to sign up using my email address so that I can start using the application without creating a password.  
**Acceptance criteria:**
- Email input validates proper email format
- Magic link sent within 30 seconds
- Link expires after 1 hour
- Successful authentication redirects to main app

**US-002** - User Login via Magic Link  
As a returning user, I want to log in using a magic link so that I can access my voice notes securely.  
**Acceptance criteria:**
- Recognizes existing user email
- Magic link sent to registered email
- Previous session remembered if "Remember me" selected
- Redirects to last viewed page after login

**US-003** - Secure Session Management  
As a user, I want my session to remain active while using the app so that I don't have to re-authenticate frequently.  
**Acceptance criteria:**
- Session persists for 7 days of activity
- Automatic refresh before expiration
- Clear logout option available
- Session works across browser tabs

### Upload & Storage
**US-004** - Single File Upload  
As a user, I want to upload a voice recording so that it can be transcribed and analyzed.  
**Acceptance criteria:**
- Supports drag-and-drop and click-to-upload
- Shows file name and size before upload
- Progress bar during upload
- Success/error message after completion
- Supports MP3, M4A, WAV, AAC, OGG formats

**US-005** - Multiple File Upload  
As a user, I want to upload multiple voice recordings at once so that I can process them in batch.  
**Acceptance criteria:**
- Select multiple files in file picker
- Drag multiple files to upload area
- Shows count of files being uploaded
- Individual progress for each file
- Continue processing if some files fail

**US-006** - Video File Audio Extraction  
As a user, I want to upload video files so that audio can be extracted and processed.  
**Acceptance criteria:**
- Accepts MP4, MOV, AVI, WebM video formats
- Extracts audio track automatically
- Same processing flow as audio files
- File size limits apply to video files

### Processing & Analysis
**US-007** - Automatic Transcription  
As a user, I want my voice recordings automatically transcribed so that I can read and search the content.  
**Acceptance criteria:**
- Transcription starts automatically after upload
- Status shows "Processing" during transcription
- Completed transcription displays in UI
- Handles multiple speakers and timestamps

**US-008** - AI-Powered Analysis  
As a user, I want AI analysis of my transcriptions so that I can quickly understand key insights.  
**Acceptance criteria:**
- Analysis generates automatically after transcription
- Shows 7-point framework results
- Sentiment clearly indicated with color/icon
- Tasks extracted and highlighted
- Analysis can be expanded/collapsed

**US-009** - Processing Status Tracking  
As a user, I want to see the status of my uploads so that I know when they'll be ready.  
**Acceptance criteria:**
- Real-time status updates (pending/processing/completed/failed)
- Time estimate for processing
- Notification when processing completes
- Option to retry failed processing

### Search & Discovery
**US-010** - Full-Text Search  
As a user, I want to search across all my voice notes so that I can find specific information.  
**Acceptance criteria:**
- Search box prominently displayed
- Searches transcription and analysis text
- Results show with highlighted matches
- Search works in real-time as typing
- Clear button to reset search

**US-011** - Filter by Date Range  
As a user, I want to filter notes by date so that I can focus on specific time periods.  
**Acceptance criteria:**
- Date picker for start and end dates
- Quick presets (today, week, month)
- Results update immediately
- Shows count of filtered results

**US-012** - Filter by Sentiment  
As a user, I want to filter notes by sentiment so that I can review positive or negative recordings.  
**Acceptance criteria:**
- Toggle buttons for positive/neutral/negative
- Multiple sentiments can be selected
- Visual indicator of selected filters
- Combines with other filters

**US-013** - Filter by Topics  
As a user, I want to filter by topics so that I can see all notes about specific subjects.  
**Acceptance criteria:**
- Click on topic tag to filter
- Shows all notes with that topic
- Topic count displayed
- Can combine with other filters

### Task Management
**US-014** - View Extracted Tasks  
As a user, I want to see all tasks mentioned in my voice notes so that I can track my commitments.  
**Acceptance criteria:**
- Tasks displayed in dedicated section
- Shows task description and source note
- Differentiates my tasks vs delegated tasks
- Tasks sorted by date

**US-015** - Mark Tasks Complete  
As a user, I want to mark tasks as complete so that I can track my progress.  
**Acceptance criteria:**
- Checkbox next to each task
- Completed tasks show strikethrough
- Completion date recorded
- Can uncomplete if needed
- Completed count updates

**US-016** - Filter Tasks by Status  
As a user, I want to filter tasks by completion status so that I can focus on what needs to be done.  
**Acceptance criteria:**
- Toggle between all/active/completed tasks
- Count shown for each status
- Persists across sessions
- Works with other task filters

**US-017** - Filter Tasks by Type  
As a user, I want to filter between my tasks and delegated tasks so that I can see my responsibilities.  
**Acceptance criteria:**
- Separate tabs for "My Tasks" and "Delegated"
- Shows assignee for delegated tasks
- Next steps shown for delegated tasks
- Counts update per filter

### Knowledge Base
**US-018** - View Aggregated Insights  
As a user, I want to see insights aggregated across all notes so that I can understand patterns.  
**Acceptance criteria:**
- Dedicated knowledge page accessible
- Shows total notes processed
- Lists all unique insights extracted
- Insights sorted by recency

**US-019** - View Topic Frequencies  
As a user, I want to see how often I discuss different topics so that I can understand my focus areas.  
**Acceptance criteria:**
- Topics shown with occurrence counts
- Sorted by frequency
- Click topic to see related notes
- Visual representation of top topics

**US-020** - Track Mentioned Contacts  
As a user, I want to see all people mentioned in my notes so that I can track my interactions.  
**Acceptance criteria:**
- List of unique contacts extracted
- Shows mention count per contact
- Click contact to see related notes
- Sorted by mention frequency

**US-021** - Sentiment Timeline  
As a user, I want to see how my sentiment changes over time so that I can track my mood patterns.  
**Acceptance criteria:**
- Visual chart of sentiment over time
- Different colors for each sentiment
- Hover shows specific date details
- Can zoom to specific date ranges

### Export & Integration
**US-022** - Export to JSON  
As a user, I want to export my data as JSON so that I can backup or analyze it externally.  
**Acceptance criteria:**
- Export button in knowledge base
- Includes all notes and analyses
- Proper JSON formatting
- Download starts immediately
- Filename includes date

**US-023** - Export to Trello  
As a user, I want to export tasks to Trello so that I can manage them in my existing workflow.  
**Acceptance criteria:**
- Connect Trello account via OAuth
- Select target board and list
- Tasks create as cards with descriptions
- Due dates set if available
- Success confirmation shown

**US-024** - Configure Trello Export  
As a user, I want to customize how tasks export to Trello so that they fit my board structure.  
**Acceptance criteria:**
- Remember last used board/list
- Option to create new list
- Can filter which tasks to export
- Preview before exporting

### Note Management
**US-025** - View Note Details  
As a user, I want to see full details of a voice note so that I can review all information.  
**Acceptance criteria:**
- Click note to expand full view
- Shows recording date and duration
- Full transcription visible
- All analysis points displayed
- Can collapse back to card view

**US-026** - Delete Voice Note  
As a user, I want to delete voice notes I no longer need so that I can manage my storage.  
**Acceptance criteria:**
- Delete button on each note
- Confirmation dialog required
- Note and audio file removed
- Updates counts immediately
- Cannot be undone warning

**US-027** - Retry Failed Processing  
As a user, I want to retry processing for failed notes so that I can recover from errors.  
**Acceptance criteria:**
- Retry button on failed notes
- Shows new processing attempt
- Can retry multiple times
- Error details available
- Success updates UI immediately

### Performance & Reliability
**US-028** - Handle Large Audio Files  
As a user, I want to upload longer recordings so that I can capture extended sessions.  
**Acceptance criteria:**
- Support files up to 25MB
- Show warning for large files
- Progress accurate for large uploads
- Processing doesn't timeout
- Clear error if file too large

**US-029** - Offline Resilience  
As a user, I want the app to handle connection issues gracefully so that I don't lose work.  
**Acceptance criteria:**
- Queued uploads resume when online
- Cached data displays when offline
- Clear offline indicator shown
- Syncs when connection restored

**US-030** - Processing Queue Visibility  
As a user, I want to see my position in the processing queue so that I can estimate wait times.  
**Acceptance criteria:**
- Shows queue position if waiting
- Updates as queue progresses
- Estimated time displayed
- Priority processing for premium (future)

### Edge Cases & Error Handling
**US-031** - Handle Unsupported File Types  
As a user, I want clear feedback when uploading unsupported files so that I know what's allowed.  
**Acceptance criteria:**
- Immediate error for wrong file types
- Lists supported formats in error
- Prevents upload from starting
- Suggests alternatives if applicable

**US-032** - Quota Exceeded Handling  
As a user, I want to know when I've reached my usage limits so that I can manage my uploads.  
**Acceptance criteria:**
- Clear message when quota exceeded
- Shows current usage vs limits
- Suggests waiting or upgrading
- Quota resets shown

**US-033** - Authentication Timeout Recovery  
As a user, I want the app to handle authentication timeouts gracefully so that I don't lose work.  
**Acceptance criteria:**
- Auto-saves work before timeout
- Prompts to re-authenticate
- Returns to previous state after login
- No data loss during timeout

**US-034** - Duplicate Upload Prevention  
As a user, I want to avoid uploading the same file twice so that I don't create duplicates.  
**Acceptance criteria:**
- Detects identical files
- Warns before creating duplicate
- Option to proceed anyway
- Shows existing note if duplicate

**US-035** - Rate Limit Communication  
As a user, I want to understand when rate limits affect me so that I can adjust my usage.  
**Acceptance criteria:**
- Clear message when rate limited
- Shows time until limit resets
- Explains what triggered limit
- Suggests spreading out usage