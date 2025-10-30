# Trello Integration Guide

The Voice Memory app now supports exporting tasks directly to Trello boards with full metadata preservation and smart organization.

## Features

- **Complete Task Export**: Export all 96 Voice Memory tasks to organized Trello boards
- **Rich Metadata**: Preserves task context, assignments, next steps, and source note links
- **Smart Organization**: Automatic board structure with separate lists for different task types
- **Rate Limited**: Respects Trello API limits with intelligent batching
- **Error Handling**: Comprehensive error handling with recovery options

## Setup Instructions

### 1. Get Trello API Credentials

1. **Create a Trello Power-Up**:
   - Visit https://trello.com/power-ups/admin
   - Click "New" to create a new Power-Up
   - Fill in basic information (name: "Voice Memory", description: "Task export integration")

2. **Get Your API Key**:
   - In your Power-Up settings, find the API Key section
   - Copy your API key

3. **Generate an Access Token**:
   - Visit this URL (replace YOUR_API_KEY with your actual key):
   ```
   https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=Voice%20Memory&key=YOUR_API_KEY
   ```
   - Allow the authorization
   - Copy the generated token

### 2. Configure Environment Variables

Add these to your `.env.local` file:

```env
TRELLO_API_KEY=your_trello_api_key_here
TRELLO_TOKEN=your_trello_token_here
```

### 3. Restart Your Application

```bash
npm run dev
```

## How to Use

1. **Access Export**: Go to your Knowledge page (`/knowledge`)
2. **Click Export Button**: Look for the purple "Export to Trello" button in the header
3. **Configure Export**: In the modal, set:
   - Board name (default: "Voice Memory Tasks - [date]")
   - Task types to include (My Tasks, Delegated Tasks, or both)
   - Date range (optional)
   - Whether to include completed tasks

4. **Export**: Click "Export to Trello" and wait for completion
5. **Access Board**: Click "Open Trello Board" to view your exported tasks

## Board Structure

### Lists Created
- **📋 My Tasks - To Do**: Personal tasks requiring your action
- **👥 Delegated Tasks**: Tasks assigned to others
- **✅ Completed My Tasks**: Finished personal tasks
- **✅ Completed Delegated**: Finished delegated tasks
- **📝 Task Backlog**: Low-priority or future tasks

### Labels Applied
- **🔵 my-task** / **🟣 delegated**: Task type identification  
- **🔴 urgent** / **🟡 normal** / **🟢 low**: Priority based on note sentiment
- **Topic labels**: Dynamic labels based on note analysis (meeting, project, etc.)

### Custom Fields
- **Voice Note ID**: Links back to original Voice Memory note
- **Recorded Date**: When the task was originally captured
- **Task Type**: My Tasks or Delegated Tasks
- **Assigned Person**: For delegated tasks
- **Primary Topic**: Main theme from voice note analysis

### Card Format

Each Trello card includes:

```markdown
## Task Details
**Type**: My Task / Delegated Task
**Recorded**: [Date from voice note]
**Source**: Voice Note #[noteId]

## Context
[AI-generated context from voice note analysis]

## Assignment Details [For delegated tasks]
**Assigned To**: [Person name]
**Next Steps**: [Specific action items]

## Voice Memory Metadata
**Task ID**: [Unique identifier]
**Original Date**: [Recording timestamp]
```

## Rate Limits & Performance

The integration respects Trello's API limits:
- **Batch Size**: 80 cards per batch (under 300 requests/10 seconds limit)
- **Batch Delay**: 11 seconds between batches
- **Progress Tracking**: Real-time progress updates during export
- **Error Recovery**: Automatic retry for rate limit errors

For 96 tasks, expect the export to take approximately 2-3 minutes.

## Troubleshooting

### "Trello Integration Required" Error
- Ensure `TRELLO_API_KEY` and `TRELLO_TOKEN` are set in `.env.local`
- Restart your development server after adding credentials
- Check that your API key and token are valid

### Export Fails During Processing
- Check browser console for detailed error messages
- Verify your Trello credentials have read/write permissions
- Ensure you haven't exceeded Trello's rate limits
- Try exporting a smaller subset of tasks first

### Cards Missing Information
- Verify your Voice Memory tasks have proper analysis data
- Check that notes have been fully processed with AI analysis
- Some fields (assignments, next steps) only apply to delegated tasks

### Token Expiration
- The integration uses non-expiring tokens by default
- If you get authentication errors, regenerate your token using the URL above
- Update the `TRELLO_TOKEN` in your `.env.local` file

## Export Options

### Task Filtering
- **Task Types**: Choose between My Tasks, Delegated Tasks, or both
- **Date Range**: Export tasks from specific time periods
- **Assignments**: Filter by who tasks are assigned to (coming soon)

### Board Customization
- **Board Name**: Customize the name of your Trello board
- **Include Completed**: Optionally include already completed tasks
- **Organization**: Tasks are automatically organized by type and priority

## Data Privacy

- Tasks are exported to your personal Trello account
- All metadata and context is preserved
- Original Voice Memory data remains unchanged
- Export creates new Trello cards - no data is moved or deleted

## Next Steps After Export

1. **Review Organization**: Check that tasks are in the correct lists
2. **Set Due Dates**: Add specific deadlines to time-sensitive tasks
3. **Assign Team Members**: Add Trello team members to delegated tasks
4. **Create Checklists**: Break down complex tasks into subtasks
5. **Set Up Automation**: Use Trello's Butler for automated workflows

The Trello integration transforms your AI-powered voice insights into an actionable task management workflow while preserving all the valuable context that makes Voice Memory unique.