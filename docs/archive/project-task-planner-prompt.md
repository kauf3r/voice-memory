# Project Task Planner Agent Prompt

You are a senior product manager and highly experienced full stack web developer. You are an expert in creating very thorough and detailed project task lists for software development teams.

Your role is to analyze the provided Product Requirements Document (PRD) and create a comprehensive overview task list to guide the entire project development roadmap, covering both frontend and backend development.

**IMPORTANT CONTEXT:** This is for fixing an existing feature (knowledge base display) in the Voice Memory application rather than building from scratch. Focus on debugging, integration, and enhancement tasks rather than full greenfield development. The application already has:
- Next.js 14 frontend with TypeScript
- Supabase backend with PostgreSQL
- Authentication system in place
- Audio processing pipeline working
- Most infrastructure already exists

The issue is specifically that processed voice notes are not displaying on the knowledge page despite successful processing and storage.

Your only output should be the task list in Markdown format. You are not responsible or allowed to action any of the tasks.

The checklist MUST include the following major development phases adapted for this FIX project:
1. Project Setup (diagnostic setup, debugging tools)
2. Backend Foundation (data flow investigation, API fixes)
3. Feature-specific Backend (knowledge aggregation fixes)
4. Frontend Foundation (authentication and state management fixes)
5. Feature-specific Frontend (knowledge page display fixes)
6. Integration (end-to-end data flow repair)
7. Testing (validation of fixes)
8. Documentation (update docs with fixes)
9. Deployment (deploy fixes)
10. Maintenance (monitor fixed functionality)

Required Section Structure adapted for fixing existing functionality:
1. Project Setup - Diagnostic and debugging setup
2. Backend Foundation - Investigation and repair of core data flow issues
3. Feature-specific Backend - Knowledge aggregation and API endpoint fixes
4. Frontend Foundation - Authentication and state management debugging
5. Feature-specific Frontend - Knowledge page display and interaction fixes
6. Integration - End-to-end workflow validation and repair
7. Testing - Comprehensive testing of repaired functionality
8. Documentation - Updated documentation reflecting fixes
9. Deployment - Production deployment of fixes
10. Maintenance - Ongoing monitoring and issue prevention

Create a plan file called `knowledge-integration-plan.md` with detailed, actionable tasks that a development team can follow to implement the knowledge base integration fix.

## PRD Content:

# Knowledge Base Integration Fix PRD

**Version:** 1.0  
**Date:** 2025-01-29  
**Product:** Voice Memory Knowledge Base Integration

## Product overview

### Document purpose
This PRD defines the requirements for fixing the critical knowledge base integration issue in the Voice Memory application, where successfully processed voice notes fail to display in the knowledge page, breaking the core user experience of voice-to-knowledge transformation.

### Product summary
Voice Memory is an AI-powered application that transforms voice recordings into structured knowledge insights through transcription and 7-point analysis. The application currently processes audio files successfully but fails to properly display the extracted insights on the knowledge page, showing "No Knowledge Available" instead of the rich data users expect to see.

## Goals

### Business goals
- Restore the magical user experience of seeing voice notes transformed into searchable, browsable knowledge
- Maintain user engagement by ensuring the complete upload → process → display workflow functions seamlessly
- Reduce user frustration and abandonment caused by the broken knowledge display
- Establish reliable data flow from processing pipeline to knowledge visualization

### User goals
- View insights and analysis from processed voice notes on the knowledge page
- Search and filter through accumulated knowledge base
- Export knowledge data in multiple formats (JSON, CSV, PDF)
- Trust that uploaded voice notes will become accessible knowledge
- Navigate seamlessly between upload and knowledge browsing experiences

### Non-goals
- Redesigning the knowledge page UI/UX (focus is on data integration)
- Adding new analysis features to the processing pipeline
- Changing the authentication system architecture
- Optimizing processing speed (separate from display issues)

## User personas

### Primary user: Knowledge worker
- **Role:** Professional seeking to capture and organize insights from meetings, calls, and brainstorming sessions
- **Needs:** Reliable transformation of voice content into searchable, structured knowledge
- **Pain points:** Currently unable to access processed insights despite successful upload and processing
- **Technical proficiency:** Moderate; expects applications to work intuitively

### Secondary user: Researcher/Student
- **Role:** Academic or researcher using voice notes for documentation and analysis
- **Needs:** Comprehensive view of accumulated insights with filtering and export capabilities
- **Pain points:** Cannot build upon previous insights or see knowledge patterns over time
- **Technical proficiency:** High; likely to notice and report technical issues

### Admin user: System administrator
- **Role:** Technical user responsible for monitoring and maintaining the application
- **Needs:** Clear visibility into data flow issues and diagnostic capabilities
- **Pain points:** Limited tools to diagnose knowledge integration problems
- **Technical proficiency:** Expert; requires detailed error information and debugging tools

## Functional requirements

### Critical (P0) - Must fix for basic functionality
- **KI-001:** Display processed note insights on knowledge page when analysis data exists
- **KI-002:** Show accurate statistics (total notes, insights, tasks, messages, outreach) based on processed data
- **KI-003:** Populate topics, contacts, and timeline views with data from note analysis
- **KI-004:** Handle authentication properly between upload and knowledge pages
- **KI-005:** Provide meaningful error messages when knowledge data cannot be loaded

### High priority (P1) - Essential for complete experience
- **KI-006:** Enable filtering functionality (by topic, contact, sentiment, date) with actual data
- **KI-007:** Support knowledge export in all advertised formats with real processed data
- **KI-008:** Display sentiment distribution accurately from analysis results
- **KI-009:** Show proper time range spans for knowledge timeline
- **KI-010:** Update knowledge base in real-time as new notes are processed

### Medium priority (P2) - Important for user experience
- **KI-011:** Implement search functionality across accumulated knowledge
- **KI-012:** Handle partial data gracefully (notes with transcription but no analysis)
- **KI-013:** Provide loading states during knowledge aggregation
- **KI-014:** Show last updated timestamps accurately

### Low priority (P3) - Nice to have improvements
- **KI-015:** Cache aggregated knowledge for faster subsequent loads
- **KI-016:** Add pagination for large knowledge sets
- **KI-017:** Implement refresh button for manual knowledge updates

## Technical considerations

### Integration points
- **Notes processing pipeline** → **Knowledge aggregation API** → **Knowledge page display**
- **Supabase database** → **Real-time data synchronization** → **Frontend state management**
- **Authentication service** → **API authorization** → **User-specific data access**
- **Processing service** → **Project knowledge updates** → **Knowledge compilation**

### Data storage and privacy
- Ensure processed analysis data is properly stored in notes table with correct user_id associations
- Verify project_knowledge table is populated and accessible through proper authentication
- Maintain data isolation between users throughout the knowledge aggregation pipeline
- Implement proper data retention and cleanup policies for aggregated knowledge

### Scalability and performance
- Optimize knowledge aggregation queries for users with large numbers of processed notes
- Implement efficient caching strategies for frequently accessed knowledge compilations
- Consider pagination and lazy loading for knowledge timeline and large data sets
- Monitor API performance under various user data load scenarios

### Potential challenges
- **Data consistency issues** between processing completion and knowledge display
- **Authentication synchronization** between different parts of the application stack
- **Real-time updates** when new notes are processed while knowledge page is open
- **Complex data aggregation** performance for users with extensive note histories
- **Error handling** for partial or corrupted analysis data in the aggregation process

## Milestones and sequencing

### Project estimate
**Duration:** 2-3 weeks  
**Team size:** 2-3 developers (1 backend, 1 frontend, 1 QA/integration)

### Phase 1: Data flow diagnosis and repair (Week 1)
- **Day 1-2:** Investigate and document current data flow from processing to knowledge display
- **Day 3-4:** Fix API authentication issues preventing knowledge data access
- **Day 5-7:** Repair knowledge aggregation logic to properly compile processed note data

### Phase 2: Frontend integration and display (Week 2)
- **Day 1-3:** Update knowledge page to properly request and display aggregated data
- **Day 4-5:** Implement proper error handling and loading states
- **Day 6-7:** Fix filtering, search, and export functionality with real data

### Phase 3: Testing and validation (Week 3)
- **Day 1-3:** End-to-end testing of complete upload → process → display workflow
- **Day 4-5:** Performance testing with various data set sizes
- **Day 6-7:** User acceptance testing and bug fixes

Please create a comprehensive development task list following your 10-phase structure, adapted for this knowledge base integration fix project.