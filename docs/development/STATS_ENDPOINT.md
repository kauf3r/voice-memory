# Stats API Endpoint

## Overview

The `/api/stats` endpoint provides a dedicated, optimized way to fetch processing statistics without triggering any processing operations. This endpoint replaces the previous approach of using the `/api/process` endpoint for stats retrieval.

## Features

- **Read-only**: Only returns statistics, never triggers processing
- **Caching**: Implements both server-side and client-side caching for improved performance
- **Authentication**: Requires valid user authentication
- **Cache invalidation**: Supports manual cache clearing

## Endpoints

### GET `/api/stats`

Returns current processing statistics for the authenticated user.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:**
```json
{
  "success": true,
  "total": 10,
  "pending": 2,
  "processing": 1,
  "completed": 6,
  "failed": 1,
  "error_rate": 10.0,
  "cached": false,
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

**Cache Headers:**
- `Cache-Control: private, max-age=30, stale-while-revalidate=60`
- `ETag: "user-id-timestamp"`

### DELETE `/api/stats`

Clears the server-side cache for the authenticated user and forces fresh data on the next request.

**Headers:**
- `Authorization: Bearer <token>` (required)

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared"
}
```

## Caching Strategy

### Server-side Caching
- **TTL**: 30 seconds
- **Storage**: In-memory Map with automatic cleanup
- **Scope**: Per-user caching
- **Cleanup**: Automatic removal of expired entries when cache size exceeds 100 items

### Client-side Caching
- **Max Age**: 30 seconds
- **Stale While Revalidate**: 60 seconds
- **ETag**: Based on user ID and time window

## Usage in Components

The `ProcessingStatus` component has been updated to use this endpoint:

```typescript
// Fetch stats (uses cache if available)
const response = await fetch('/api/stats', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
  },
})

// Clear cache and get fresh data
const clearStatsCache = async () => {
  await fetch('/api/stats', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  })
  await fetchStats() // Fetch fresh data
}
```

## Benefits

1. **Performance**: Reduces database queries through effective caching
2. **Separation of Concerns**: Stats retrieval is separate from processing operations
3. **Better User Experience**: Faster loading times and auto-refresh capabilities
4. **Scalability**: Server-side caching reduces database load

## Migration

### Before
```typescript
// ProcessingStatus.tsx - OLD
const response = await fetch('/api/process', {
  method: 'PUT', // This would also trigger processing
  // ...
})
```

### After
```typescript
// ProcessingStatus.tsx - NEW
const response = await fetch('/api/stats', {
  method: 'GET', // Read-only operation
  // ...
})
```

## Error Handling

The endpoint returns appropriate HTTP status codes:

- `200`: Success
- `401`: Unauthorized (missing or invalid authentication)
- `500`: Internal server error

## Testing

Run the test script to verify the endpoint:

```bash
npx tsx scripts/test-stats-endpoint.ts
```

## Performance Considerations

- Cache TTL of 30 seconds balances freshness with performance
- Automatic cache cleanup prevents memory leaks
- ETag headers enable conditional requests
- Client-side caching reduces server requests

## Future Enhancements

- Redis-based caching for multi-instance deployments
- Websocket real-time updates for critical stats changes
- Metrics collection for cache hit/miss ratios
- Enhanced cache warming strategies 