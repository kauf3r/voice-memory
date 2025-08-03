# Enhanced Error Handling for Rate Limiter and Quota Manager

This document describes the robust error handling and table existence checks implemented in the voice-memory application's rate limiting and quota management systems.

## Overview

The enhanced error handling ensures the application continues to function gracefully even when:
- Database tables don't exist (migration not applied)
- Database permissions are insufficient
- Network connectivity issues occur
- Database operations temporarily fail

## Key Features

### 1. Table Existence Checking

Both the RateLimiter and QuotaManager now check for table existence before attempting operations:

- **Cached checks**: Table existence is cached for 5 minutes to avoid overhead
- **Multiple error types**: Handles various PostgreSQL error codes and messages
- **Automatic re-checking**: Invalidates cache when tables are dropped during operation

#### Error Codes Handled

| Error Code | Description | Action |
|------------|-------------|---------|
| `42P01` | Relation does not exist | Fall back to memory/defaults |
| `42501` | Insufficient privilege | Fall back to memory/defaults |
| `PGRST116` | No rows returned (PostgREST) | Continue operation (expected) |

### 2. RateLimiter Enhancements

#### Table Dependencies
- **Primary**: `rate_limits` table for cross-instance coordination
- **Fallback**: In-memory rate limiting when table unavailable

#### Key Improvements

```typescript
// Before: Simple database attempt with basic fallback
if (error && error.code !== 'PGRST116') {
  console.warn('Rate limit database error, falling back to memory:', error)
  return this.canMakeRequestMemory(service, limit)
}

// After: Comprehensive error handling with table existence checks
if (!(await this.checkTableExists())) {
  console.warn(`Rate limiting: falling back to memory for service: ${service}`)
  return this.canMakeRequestMemory(service, limit)
}
```

#### Features

1. **Proactive Table Checking**: Verifies table exists before operations
2. **Retry Logic**: 3 retries with exponential backoff for database operations
3. **Data Validation**: Ensures rate limit data integrity
4. **Graceful Degradation**: Always provides working rate limiting via memory fallback

### 3. QuotaManager Enhancements

#### Table Dependencies
- **Primary**: `notes`, `processing_attempts`, `api_usage` tables
- **Fallback**: Default values when tables unavailable

#### Key Improvements

```typescript
// Before: Direct database queries with basic error handling
const { count: notesCount } = await this.getSupabase()
  .from('notes')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)

// After: Safe operations with table existence checks
private async getNotesCount(userId: string): Promise<number> {
  if (!(await this.isTableAvailable('notes'))) {
    console.warn('QuotaManager: notes table not available, returning 0 count')
    return 0
  }
  
  return this.safeDbOperation(/* ... */)
}
```

#### Features

1. **Individual Table Checks**: Each table dependency checked separately
2. **Parallel Operations**: Usage data fetched concurrently with individual error handling
3. **Retry Mechanisms**: Robust retry logic for write operations
4. **Fail-Open Design**: Allows operations when quota checks fail (availability over accuracy)

## Configuration

### Environment Variables

```bash
# Enable database rate limiting (falls back to memory if table missing)
USE_DATABASE_RATE_LIMITING=true

# Rate limiting configuration
OPENAI_WHISPER_RATE_LIMIT=50
OPENAI_GPT_RATE_LIMIT=200
```

### Table Setup

The enhanced error handling works with or without these tables:

```sql
-- Rate limiting table (optional)
CREATE TABLE rate_limits (
    service VARCHAR(50) PRIMARY KEY,
    requests BIGINT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quota management tables (optional)
CREATE TABLE api_usage (
    user_id UUID,
    date DATE,
    tokens_used INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
);

CREATE TABLE processing_attempts (
    user_id UUID,
    attempted_at TIMESTAMP DEFAULT NOW()
);
```

## Behavior Matrix

| Table Status | Rate Limiter | Quota Manager | User Experience |
|-------------|--------------|---------------|-----------------|
| All tables exist | Full functionality | Full quota tracking | Complete features |
| Some tables missing | Memory fallback | Partial tracking | Reduced tracking, full functionality |
| No tables exist | Memory only | Default values | Works, no persistence |
| Database down | Memory only | Fail-open | Works, no persistence |

## Testing

Run the comprehensive error handling test:

```bash
npx tsx scripts/test-enhanced-error-handling.ts
```

This test validates:
- ✅ Graceful handling of missing tables
- ✅ Proper fallback mechanisms
- ✅ Table existence checking
- ✅ Retry mechanisms
- ✅ Fail-open behavior for quota checks

## Migration Compatibility

The enhanced error handling is designed to work with any migration state:

### Pre-Migration (Tables Don't Exist)
- Rate limiter uses memory-only implementation
- Quota manager returns default values
- All core functionality remains available

### Post-Migration (Tables Exist)
- Full database persistence and tracking
- Cross-instance rate limiting coordination
- Detailed quota and usage analytics

### Partial Migration
- Works with whatever tables are available
- Gracefully handles missing tables
- Provides feedback about what's available

## Monitoring and Logging

### Log Messages

The enhanced error handling provides detailed logging:

```bash
# Table existence warnings
QuotaManager: api_usage table does not exist
Rate limiting: rate_limits table does not exist, using memory fallback

# Fallback notifications
Rate limiting: falling back to memory for service: whisper
QuotaManager: processing_attempts table not available, returning 0 count

# Retry information
QuotaManager: failed to record token usage after 3 retries: [error]
Rate limiting: failed to update database after 3 retries for service gpt4, falling back to memory
```

### Metrics to Monitor

1. **Fallback Frequency**: How often memory fallback is used
2. **Table Availability**: Which tables are consistently unavailable
3. **Retry Success Rates**: How often retries succeed vs fail
4. **Error Patterns**: Common database error types

## Best Practices

### For Developers

1. **Always handle both scenarios**: Code should work with and without database tables
2. **Fail-open for user-facing features**: When in doubt, allow the operation
3. **Log but don't crash**: Database issues shouldn't break core functionality
4. **Use caching wisely**: Balance between performance and accuracy

### For Operations

1. **Monitor fallback usage**: High fallback rates indicate database issues
2. **Apply migrations**: For full functionality, ensure all migrations are applied
3. **Check permissions**: Verify database user has necessary table permissions
4. **Plan for degradation**: Understand what works when database is unavailable

## Recovery Procedures

### When Database is Unavailable
1. Application continues to function with memory-only operation
2. User experience is minimally impacted
3. No data loss for core features (uploads, processing)
4. Quota tracking temporarily disabled

### When Tables are Missing
1. Run migration script: `npx tsx scripts/manage-migration.ts apply`
2. Verify table creation: `npx tsx scripts/manage-migration.ts verify`
3. Restart application if needed
4. Monitor logs for successful table detection

### When Permissions are Insufficient
1. Check database user permissions
2. Grant necessary permissions on tables
3. Application will automatically detect restored access
4. No restart required due to periodic re-checking

## Future Enhancements

Potential improvements to the error handling system:

1. **Metrics Collection**: Expose fallback rates and error counts as metrics
2. **Circuit Breaker**: Temporarily disable database operations after repeated failures
3. **Health Checks**: Endpoint to report database table availability status
4. **Auto-Recovery**: Automatic retry of table existence checks on schedule
5. **Alerting**: Notifications when fallback mode is active for extended periods

## Conclusion

The enhanced error handling ensures that the voice-memory application is resilient to database issues while maintaining full functionality. Users experience consistent behavior regardless of the database state, and administrators have clear visibility into any infrastructure issues that need attention. 