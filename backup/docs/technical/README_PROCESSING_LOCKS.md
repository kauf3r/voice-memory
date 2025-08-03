# Processing Lock Implementation

This document describes the row-level locking mechanism implemented to prevent concurrent processing of the same notes.

## Problem Solved

Before this implementation, multiple processes (cron jobs, manual triggers, batch processing) could potentially pick up and process the same note simultaneously, leading to:

- Duplicate processing costs
- Race conditions in database updates
- Inconsistent state
- Wasted resources

## Solution Overview

The solution implements a comprehensive locking mechanism using:

1. **Database-level row locking** with `SELECT FOR UPDATE`
2. **Processing state tracking** with `processing_started_at` timestamp
3. **Automatic cleanup** of abandoned processing attempts
4. **Lock timeout mechanism** for recovery from stuck processes

## Database Schema Changes

### New Column: `processing_started_at`
```sql
ALTER TABLE notes 
ADD COLUMN processing_started_at TIMESTAMP WITH TIME ZONE;
```

This timestamp tracks when processing begins, serving as both a lock indicator and timeout reference.

### New Database Functions

#### `acquire_processing_lock(note_id, timeout_minutes)`
- Attempts to acquire an exclusive processing lock for a note
- Returns `true` if lock acquired, `false` if already locked
- Automatically handles timeout scenarios
- Increments processing attempts counter

#### `release_processing_lock(note_id)`
- Releases the processing lock and marks the note as processed
- Sets `processed_at` timestamp
- Clears `processing_started_at`

#### `release_processing_lock_with_error(note_id, error_message)`
- Releases lock when processing fails
- Records error details
- Clears `processing_started_at`

#### `cleanup_abandoned_processing_locks(timeout_minutes)`
- Finds and cleans up locks older than the timeout
- Marks abandoned attempts as failed
- Returns count of cleaned locks

#### `get_next_notes_for_processing(user_id, limit, timeout_minutes)`
- Returns notes available for processing (respects locks)
- Uses `FOR UPDATE SKIP LOCKED` to avoid blocking
- Handles timeout scenarios automatically

## How It Works

### 1. Lock Acquisition
```typescript
// Before processing any note
const lockAcquired = await supabase.rpc('acquire_processing_lock', {
  p_note_id: noteId,
  p_lock_timeout_minutes: 15
})

if (!lockAcquired) {
  // Note is already being processed or already completed
  return { success: false, error: 'Note is currently being processed' }
}
```

### 2. Processing with Lock Protection
```typescript
try {
  // Process the note (transcription + analysis)
  const result = await processJobWithLock(job)
  
  // Release lock on success
  await releaseProcessingLock(noteId)
  
} catch (error) {
  // Release lock on failure
  await releaseProcessingLockWithError(noteId, error.message)
}
```

### 3. Batch Processing Protection
```typescript
// Get notes available for processing (respects locks)
const { data: notes } = await supabase.rpc('get_next_notes_for_processing', {
  p_user_id: null,
  p_limit: batchSize,
  p_lock_timeout_minutes: 15
})

// Each note is automatically locked when retrieved
```

### 4. Automatic Cleanup
```typescript
// Cleanup abandoned locks before batch processing
await supabase.rpc('cleanup_abandoned_processing_locks', { 
  p_timeout_minutes: 15 
})
```

## Key Features

### ✅ Race Condition Prevention
- Multiple processes cannot acquire the same lock
- Database-level atomicity ensures consistency
- `SELECT FOR UPDATE SKIP LOCKED` prevents blocking

### ✅ Timeout Recovery
- Processes that crash or hang don't block notes forever
- Configurable timeout (default: 15 minutes)
- Automatic cleanup marks abandoned attempts as failed

### ✅ Performance Optimization
- `SKIP LOCKED` prevents waiting for locked rows
- Indexed queries for fast lock status checks
- Efficient batch processing without conflicts

### ✅ Error Handling
- Failed processing attempts are properly tracked
- Error messages preserved for debugging
- Processing attempt counters for monitoring

### ✅ Monitoring & Observability
- Enhanced processing statistics include lock status
- Clear distinction between pending, processing, completed, and failed
- Lock cleanup logging for operational visibility

## Configuration

### Lock Timeout
Default: 15 minutes. Configurable per operation:
```typescript
await processingService.processNote(noteId, userId, false)
// Uses 15-minute timeout

await supabase.rpc('acquire_processing_lock', {
  p_note_id: noteId,
  p_lock_timeout_minutes: 30  // Custom timeout
})
```

### Cleanup Frequency
Automatic cleanup runs:
- Before each batch processing operation
- When getting processing statistics
- Can be triggered manually for stuck detection

## Testing

### Run the Test Suite
```bash
npx tsx scripts/test-processing-lock.ts
```

### Demo Concurrent Protection
```bash
npx tsx scripts/demo-concurrent-processing-protection.ts
```

### Apply Migration
```bash
npx tsx scripts/apply-processing-lock-migration.ts
```

## Migration Steps

1. **Apply the database migration:**
   ```sql
   -- Run the contents of: supabase/migrations/20240120_add_processing_lock.sql
   ```

2. **Verify functions are created:**
   ```typescript
   // Test basic functionality
   const { data } = await supabase.rpc('cleanup_abandoned_processing_locks')
   ```

3. **Update application code:**
   - Code already updated in `lib/processing-service.ts`
   - No client-side changes required

## Benefits

### Before (Without Locks)
- ❌ Race conditions possible
- ❌ Duplicate processing costs
- ❌ Inconsistent state updates
- ❌ No protection against stuck processes

### After (With Locks)
- ✅ Guaranteed exclusive processing
- ✅ Cost optimization through prevention of duplicates
- ✅ Consistent state management
- ✅ Automatic recovery from failures
- ✅ Enhanced monitoring and observability

## Monitoring

Check processing statistics:
```typescript
const stats = await processingService.getProcessingStats(userId)
// Returns: { total, pending, processing, completed, failed }
```

The `processing` count now accurately reflects notes currently being processed (have an active lock), while `pending` represents notes waiting to be picked up.

## Troubleshooting

### Stuck Processing
If notes appear stuck in processing:
```typescript
// Force cleanup of abandoned locks
await supabase.rpc('cleanup_abandoned_processing_locks', { 
  p_timeout_minutes: 5  // Aggressive cleanup
})
```

### Reset All Processing
For development/testing:
```typescript
// Reset all unprocessed notes
await processingService.resetStuckProcessing(true)
```

### Check Lock Status
```typescript
const { data: note } = await supabase
  .from('notes')
  .select('processing_started_at, processed_at')
  .eq('id', noteId)
  .single()

console.log('Lock active:', !!note.processing_started_at)
console.log('Processed:', !!note.processed_at)
``` 