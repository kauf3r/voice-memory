# Voice Memory API Documentation

This document provides comprehensive documentation for all API endpoints in the Voice Memory application.

## Base Information

- **Base URL**: `http://localhost:3000/api` (development) or `https://your-domain.com/api` (production)
- **Authentication**: Bearer token (Supabase JWT)
- **Content-Type**: `application/json` (unless otherwise specified)
- **Response Format**: JSON
- **Version**: 1.1.0 (Enhanced with monitoring and admin endpoints)

## Authentication

All API endpoints require authentication using a Bearer token in the Authorization header:

```http
Authorization: Bearer <supabase-jwt-token>
```

### Error Responses

```json
{
  "error": "Missing or invalid authorization header",
  "status": 401
}
```

## Core Endpoints

### 1. Audio Upload

Upload audio files for transcription and analysis.

**Endpoint**: `POST /api/upload`

**Content-Type**: `multipart/form-data`

**Request Body**:
```
audio: File (required) - Audio file (.mp3, .m4a, .wav, .aac, .ogg, .webm, .mp4)
```

**Response**:
```json
{
  "success": true,
  "noteId": "uuid",
  "message": "File uploaded successfully"
}
```

**Error Responses**:
- `400`: Invalid file type or missing file
- `401`: Unauthorized
- `413`: File too large
- `429`: Rate limit exceeded

### 2. Notes Management

#### Get All Notes
**Endpoint**: `GET /api/notes`

**Query Parameters**:
- `limit` (optional): Number of notes to return (default: 50)
- `offset` (optional): Number of notes to skip (default: 0)

**Response**:
```json
{
  "notes": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "audio_url": "string",
      "duration_seconds": 123,
      "transcription": "string",
      "analysis": {
        "sentiment": "positive|negative|neutral",
        "topics": ["string"],
        "tasks": ["string"],
        "ideas": ["string"],
        "messages": ["string"],
        "cross_references": ["string"],
        "outreach": ["string"]
      },
      "recorded_at": "ISO date",
      "processed_at": "ISO date",
      "created_at": "ISO date"
    }
  ],
  "total": 123,
  "hasMore": true
}
```

#### Get Single Note
**Endpoint**: `GET /api/notes/[id]`

**Response**: Same as individual note object above

#### Filter Notes
**Endpoint**: `GET /api/notes/filter`

**Query Parameters**:
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `sentiment` (optional): positive|negative|neutral
- `hasAnalysis` (optional): true|false

### 3. Task Management

#### Get Pinned Tasks
**Endpoint**: `GET /api/tasks/pinned`

**Response**:
```json
{
  "tasks": [
    {
      "id": "string",
      "task": "string",
      "note_id": "uuid",
      "pinned_at": "ISO date",
      "pin_order": 1,
      "completed": false
    }
  ]
}
```

#### Pin Task
**Endpoint**: `POST /api/tasks/[id]/pin`

**Request Body**:
```json
{
  "task": "Task description"
}
```

**Response**:
```json
{
  "success": true,
  "task": {
    "id": "string",
    "task": "string",
    "pinned_at": "ISO date",
    "pin_order": 1
  }
}
```

#### Unpin Task
**Endpoint**: `DELETE /api/tasks/[id]/pin`

**Response**:
```json
{
  "success": true,
  "message": "Task unpinned"
}
```

#### Reorder Pins
**Endpoint**: `POST /api/tasks/reorder-pins`

**Request Body**:
```json
{
  "taskOrder": [
    {
      "id": "string",
      "pin_order": 1
    }
  ]
}
```

### 4. Knowledge Management

#### Get Knowledge Base
**Endpoint**: `GET /api/knowledge`

**Response**:
```json
{
  "summary": {
    "totalNotes": 123,
    "analyzedNotes": 120,
    "pendingNotes": 3
  },
  "insights": {
    "topTopics": ["topic1", "topic2"],
    "sentimentDistribution": {
      "positive": 60,
      "neutral": 30,
      "negative": 10
    },
    "totalTasks": 45,
    "completedTasks": 12
  },
  "aggregatedData": {
    "allTopics": ["topic1", "topic2"],
    "allTasks": ["task1", "task2"],
    "allIdeas": ["idea1", "idea2"],
    "allMessages": ["message1", "message2"],
    "crossReferences": ["ref1", "ref2"],
    "outreachItems": ["outreach1", "outreach2"]
  }
}
```

#### Export Knowledge
**Endpoint**: `GET /api/knowledge/export`

**Query Parameters**:
- `format`: json|csv|txt (default: json)

**Response**: File download with appropriate content-type

### 5. Processing & Status

#### Get Processing Status
**Endpoint**: `GET /api/processing-status`

**Response**:
```json
{
  "status": "idle|processing|error",
  "queue": {
    "pending": 3,
    "processing": 1,
    "completed": 245,
    "failed": 2
  },
  "currentlyProcessing": ["note-id-1"],
  "lastProcessed": "ISO date"
}
```

#### Process Note
**Endpoint**: `POST /api/process`

**Request Body**:
```json
{
  "noteId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Processing started",
  "noteId": "uuid"
}
```

#### Batch Process
**Endpoint**: `POST /api/process/batch`

**Request Body**:
```json
{
  "noteIds": ["uuid1", "uuid2"]
}
```

#### Reset Processing
**Endpoint**: `POST /api/process/reset`

**Request Body**:
```json
{
  "noteId": "uuid"
}
```

### 6. Search

#### Search Notes
**Endpoint**: `GET /api/search`

**Query Parameters**:
- `q` (required): Search query
- `type` (optional): transcription|analysis|all (default: all)
- `limit` (optional): Number of results (default: 20)

**Response**:
```json
{
  "results": [
    {
      "note": "Note object",
      "matches": [
        {
          "field": "transcription|analysis",
          "context": "...highlighted text...",
          "score": 0.95
        }
      ]
    }
  ],
  "total": 15,
  "query": "search term"
}
```

### 7. Statistics

#### Get Stats
**Endpoint**: `GET /api/stats`

**Response**:
```json
{
  "overview": {
    "totalNotes": 123,
    "totalDuration": 7200,
    "avgDuration": 58.5,
    "analysisComplete": 120
  },
  "byPeriod": {
    "today": 5,
    "thisWeek": 23,
    "thisMonth": 87
  },
  "sentiment": {
    "positive": 45,
    "neutral": 30,
    "negative": 25
  },
  "topTopics": ["work", "ideas", "meetings"],
  "processingStats": {
    "avgProcessingTime": 15.3,
    "successRate": 98.5
  }
}
```

## Monitoring & Debug Endpoints

### Health Check
**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "ISO date",
  "services": {
    "database": "connected",
    "openai": "connected",
    "storage": "connected"
  }
}
```

### Performance Metrics
**Endpoint**: `GET /api/performance`

**Response**:
```json
{
  "metrics": {
    "responseTime": 145,
    "memoryUsage": 67.5,
    "cpuUsage": 23.1,
    "activeConnections": 12
  },
  "uptime": 7200,
  "version": "1.0.0"
}
```


## Integration Endpoints

### Trello Export
**Endpoint**: `POST /api/trello/export`

**Request Body**:
```json
{
  "tasks": ["task1", "task2"],
  "boardId": "trello-board-id",
  "listId": "trello-list-id"
}
```

**Response**:
```json
{
  "success": true,
  "exported": 2,
  "trelloCards": ["card-id-1", "card-id-2"]
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Upload endpoints**: 10 requests per minute per user
- **Processing endpoints**: 5 requests per minute per user
- **General endpoints**: 100 requests per minute per user

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional details",
  "timestamp": "ISO date"
}
```

### Common Error Codes

- `UNAUTHORIZED`: Invalid or missing authentication
- `FORBIDDEN`: Insufficient permissions
- `VALIDATION_ERROR`: Invalid request data
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `PROCESSING_ERROR`: Audio processing failed
- `STORAGE_ERROR`: File storage/retrieval failed
- `DATABASE_ERROR`: Database operation failed

## SDKs and Examples

### JavaScript/TypeScript Example

```typescript
class VoiceMemoryAPI {
  constructor(private baseUrl: string, private token: string) {}

  async uploadAudio(file: File): Promise<{noteId: string}> {
    const formData = new FormData();
    formData.append('audio', file);

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });

    return response.json();
  }

  async getNotes(limit = 50, offset = 0) {
    const response = await fetch(
      `${this.baseUrl}/api/notes?limit=${limit}&offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      }
    );

    return response.json();
  }
}
```

### cURL Examples

```bash
# Upload audio file
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "audio=@voice-note.mp3"

# Get notes
curl -X GET http://localhost:3000/api/notes \
  -H "Authorization: Bearer YOUR_TOKEN"

# Pin a task
curl -X POST http://localhost:3000/api/tasks/task-id/pin \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task": "Complete project documentation"}'
```

## 5. Monitoring Endpoints (New in v1.1)

### System Health
**Endpoint**: `GET /api/monitoring/health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "ISO date",
  "services": {
    "database": "healthy",
    "openai": "healthy", 
    "supabase": "healthy"
  },
  "metrics": {
    "uptime": 3600,
    "memoryUsage": "85%",
    "responseTime": "120ms"
  }
}
```

### Performance Metrics
**Endpoint**: `GET /api/monitoring/performance`

**Response**:
```json
{
  "metrics": {
    "averageResponseTime": 150,
    "requestsPerSecond": 25,
    "errorRate": 0.02,
    "activeConnections": 45
  },
  "trends": {
    "direction": "improving",
    "change": 5
  }
}
```

### System Alerts
**Endpoint**: `GET /api/monitoring/alerts`

**Response**:
```json
{
  "alerts": [
    {
      "id": "alert-1",
      "severity": "warning",
      "message": "High response time detected",
      "timestamp": "ISO date",
      "resolved": false
    }
  ],
  "summary": {
    "total": 3,
    "critical": 0,
    "warnings": 2,
    "info": 1
  }
}
```

## 6. Admin Endpoints (New in v1.1)

**Note**: Admin endpoints require special authorization (admin API key).

### Background Jobs
**Endpoint**: `GET /api/admin/background-jobs`

**Headers**:
```
x-admin-key: your-admin-api-key
```

**Response**:
```json
{
  "jobs": [
    {
      "id": "job-1",
      "type": "audio_processing",
      "status": "running",
      "progress": 75,
      "started_at": "ISO date"
    }
  ],
  "summary": {
    "total": 10,
    "running": 3,
    "completed": 6,
    "failed": 1
  }
}
```

### System Performance
**Endpoint**: `POST /api/admin/system-performance`

**Request Body**:
```json
{
  "action": "get_system_metrics",
  "timeframe": "24h"
}
```

**Response**:
```json
{
  "metrics": {
    "cpu_usage": "45%",
    "memory_usage": "67%",
    "disk_usage": "23%",
    "network_io": "45MB/s"
  },
  "performance": {
    "average_processing_time": "2.3s",
    "queue_length": 5,
    "success_rate": "98.5%"
  }
}
```

## Webhooks

The API supports webhooks for real-time notifications:

- `note.processed` - When audio processing completes
- `task.pinned` - When a task is pinned
- `analysis.completed` - When AI analysis finishes  
- `system.alert` - When system alerts are triggered (New in v1.1)
- `performance.threshold` - When performance thresholds are exceeded (New in v1.1)

## Versioning

The API follows semantic versioning. Current version: `v1.1`

Future versions will be available at `/api/v2/` etc.

### Version 1.1 Changes
- Added comprehensive monitoring endpoints
- Added admin endpoints for system management
- Enhanced task completion tracking
- Added real-time health monitoring
- Improved error handling and recovery

## Support

For API support:
- Check the error response for specific error codes
- Review the comprehensive error handling documentation
- Use the health check endpoint to verify service status
- Monitor rate limiting headers to avoid limits
- Use the new monitoring endpoints for system insights (v1.1+)
- Check admin endpoints for detailed system performance (v1.1+)