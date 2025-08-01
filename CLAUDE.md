# CLAUDE.md - Voice Memory Project Guide (Simplified)

[... existing content remains unchanged ...]

## Current Project Status (January 2025)

### Core Functionality Complete
- ✅ **Voice Processing Pipeline**: Upload → Transcribe → Analyze → Store → Display fully operational
- ✅ **7-Point AI Analysis**: Sentiment, Topics, Tasks, Ideas, Messages, Cross-References, Outreach
- ✅ **Knowledge Management**: Aggregated knowledge base with export functionality
- ✅ **Task Management**: Complete pin/unpin system with real-time updates
- ✅ **Authentication**: Robust auth system with timeout handling and error recovery
- ✅ **User Experience**: Toast notifications, loading states, error boundaries
- ✅ **Performance**: Optimized for production with Next.js 15.4.5

### Technical Infrastructure
- ✅ **Database Schema**: Complete with task_pins and task_completions tables
- ✅ **Real-time Features**: Supabase subscriptions for live updates
- ✅ **API Endpoints**: Comprehensive REST API with proper authentication
- ✅ **Security**: Enhanced CSP headers and security configuration
- ✅ **Testing**: End-to-end testing framework established
- ✅ **Documentation**: Complete setup and development guides

### Recent Achievements (January 2025)
- **Multi-Computer Development Workflow**: Complete git workflow system with corruption prevention
- **Repository Recovery**: Fixed severe git corruption and restored complete project state
- **Developer Experience**: One-command setup script and VS Code integration
- **Enhanced documentation**: Updated README, created CHANGELOG, multi-computer guides
- **Git Safety Features**: Automatic stashing, conflict resolution, repository health monitoring
- **Production Optimization**: Next.js 15.4.5 with advanced optimizations
- **Enhanced error handling**: Toast notifications, circuit breakers, graceful degradation

### Current Status: Production Ready + Multi-Computer Development
The Voice Memory project is now fully production-ready with enterprise-grade development workflows:
- ✅ **Production Features**: All core functionality implemented and tested
- ✅ **Multi-Computer Workflow**: Seamless development across multiple machines
- ✅ **Git Safety**: Corruption prevention and automated recovery procedures
- ✅ **Developer Onboarding**: One-command setup for new development environments
- ✅ **Documentation**: Comprehensive guides for development and deployment
- ✅ **Performance**: Optimized build system and monitoring

### Next Phase Priorities
1. **Enterprise Features**: Advanced user management, team collaboration
2. **Scaling Optimization**: Performance tuning for increased usage
3. **Advanced Analytics**: Enhanced monitoring and insights
4. **Mobile App**: Native mobile application development

## Multi-Computer Development Workflow

### Git Workflow Commands
The project includes a comprehensive git workflow system designed for seamless development across multiple computers:

```bash
# Daily workflow commands
npm run git:start    # Start work session (pull, stash management)
npm run git:save     # Save work (commit with safety checks, push)
npm run git:sync     # Sync changes (handle conflicts, merge)
npm run git:status   # Check repository health and status
npm run git:clean    # Clean working directory (with confirmation)
```

### Repository Safety Features
- **Automatic Health Checks**: Every operation includes `git fsck` to detect corruption
- **Smart Stash Management**: Automatic stashing/unstashing of uncommitted changes
- **Conflict Resolution**: Guided conflict resolution with clear recovery steps
- **Branch Management**: Ensures work happens on correct branch (`main`)
- **Recovery Procedures**: Built-in backup and recovery for corruption scenarios

### Developer Onboarding
New developers can set up the complete development environment with a single command:

```bash
git clone https://github.com/kauf3r/voice-memory.git
cd voice-memory
npm run setup  # Complete environment setup
```

The setup script automatically:
- Installs dependencies
- Creates environment files
- Sets up git hooks
- Configures VS Code settings
- Validates prerequisites

### Development Patterns
- **Pre-commit Hooks**: Automatic linting, type checking, and formatting
- **Post-merge Hooks**: Automatic dependency updates when package-lock.json changes
- **Environment Isolation**: Machine-specific settings in `.env.local.[computer-name]`
- **VS Code Integration**: Consistent editor configuration across all machines

### Known Patterns & Best Practices
- Always use `npm run git:start` before beginning work
- Save frequently with `npm run git:save` before switching computers
- Never bypass the workflow commands - they include critical safety checks
- Keep environment files local and never commit sensitive information
- Use the built-in diagnostics (`npm run git:status`) for troubleshooting

## Authentication & Client Solutions

### Supabase Authentication Resolution
- **Timeout Implementation**: Added 15-second timeout for magic link requests to prevent hanging
- **Token Validation**: Enhanced server-side token validation with detailed error reporting
- **Session Management**: Improved session handling with proper state management
- **Error Recovery**: Graceful handling of authentication errors with user feedback
- **Real-time Sync**: Enhanced auth state synchronization across components

### Known Patterns & Best Practices
- Always call hooks at the top level of components (no conditional hooks)
- Use optimistic updates with proper rollback mechanisms
- Implement proper cleanup in useEffect hooks
- Handle real-time subscription lifecycle properly
- Provide user feedback through toast notifications

## Recent Development Updates (January 2025)

### Authentication & Session Management
- **Enhanced AuthProvider**: Implemented robust authentication with timeout handling (15-second timeout for magic link requests)
- **Session Validation**: Added comprehensive token validation in API routes with detailed logging
- **Error Recovery**: Improved error handling for authentication failures with graceful fallbacks
- **Real-time Auth**: Enhanced auth state change listeners with proper cleanup and mounted state checks

### Task Management System
- **Task Pinning**: Complete implementation of task pinning/unpinning functionality
- **Real-time Updates**: Supabase real-time subscriptions for task pin changes
- **Optimistic Updates**: Implemented optimistic UI updates with rollback on errors
- **Task Reordering**: Drag-and-drop reordering with server-side persistence
- **Pin Limits**: Configurable pin limits (default: 10 tasks) with validation
- **Completion Tracking**: Integration with task completion system

### User Experience Improvements
- **Toast Notifications**: New ToastProvider system for user feedback
- **Connection Status**: Real-time connection status indicators
- **Loading States**: Enhanced loading states throughout the application
- **Error Boundaries**: Comprehensive error handling with recovery options

### Architecture & Performance
- **Next.js 15.4.5**: Upgraded to latest Next.js version
- **Configuration Updates**: Moved serverComponentsExternalPackages, removed deprecated swcMinify
- **Security Headers**: Enhanced CSP and security headers in Next.js config
- **Bundle Optimization**: Improved webpack configuration for better caching
- **Database Optimizations**: Enhanced query performance with proper indexing

### API Enhancements
- **Knowledge API**: Improved error handling and data aggregation
- **Task APIs**: New endpoints for task pinning, unpinning, and reordering
- **Authentication Flow**: Enhanced token-based authentication across all endpoints
- **Request Logging**: Comprehensive logging for debugging and monitoring

### Development Patterns
- **Hook Consistency**: All React hooks called at component top-level (no conditional hooks)
- **State Management**: Proper state updates with cleanup functions
- **Error Handling**: Try-catch blocks with detailed error reporting
- **Real-time Subscriptions**: Proper subscription cleanup and reconnection logic

## Technical Implementation Details

### Next.js Configuration Changes
- **External Packages**: Moved `serverExternalPackages` to proper location (was `serverComponentsExternalPackages`)
- **Deprecated Options**: Removed `swcMinify` (deprecated in Next.js 15)
- **Security Headers**: Enhanced CSP with proper directives for Supabase and OpenAI
- **Bundle Optimization**: Improved webpack configuration for vendor chunk splitting

### Component Architecture Updates
- **ToastProvider**: New global toast notification system integrated into root layout
- **PinnedTasksProvider**: Comprehensive task management with optimistic updates
- **AuthProvider**: Enhanced with timeout handling and better error recovery
- **Knowledge Page**: Simplified architecture with proper hook ordering

### Database Schema Extensions
```typescript
// New tables added:
task_pins {
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES users(id),
  task_id: text NOT NULL,
  pinned_at: timestamptz DEFAULT now(),
  pin_order: integer DEFAULT 0
}

task_completions {
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES users(id),
  task_id: text NOT NULL,
  completed_at: timestamptz DEFAULT now(),
  completed_by: text,
  notes: text
}
```

### API Route Enhancements
- **Authentication**: Consistent token validation across all endpoints
- **Error Handling**: Structured error responses with detailed logging
- **Performance**: Optimized database queries with proper indexing
- **Security**: Enhanced validation and sanitization

### Real-time Features
- **Task Pins**: Live updates when tasks are pinned/unpinned
- **Connection Status**: Visual indicators for real-time connection state
- **Optimistic Updates**: Immediate UI feedback with server confirmation
- **Error Recovery**: Automatic rollback on failed operations