# System Processing Stats Functions

This document describes the system-level processing statistics functions added to handle administrative health checks and system monitoring without requiring user-specific parameters.

## Overview

The original `get_processing_stats(p_user_id)` function required a user ID parameter, which caused issues in scripts that needed system-level health checks. This update provides:

1. **Fixed `get_processing_stats()`** - Original function with table name bug fixed
2. **New `get_system_processing_stats()`** - Administrative stats without user requirement  
3. **New `get_system_health_stats()`** - Quick system health overview

## Functions

### 1. `get_processing_stats(p_user_id UUID)` [FIXED]

**Purpose**: Get processing statistics for a specific user  
**Parameters**: `p_user_id` (UUID) - The user ID to get stats for  
**Returns**: User-specific processing statistics

```sql
SELECT * FROM get_processing_stats('user-uuid-here');
```

**Returns**:
```json
{
  "total": 25,
  "pending": 3,
  "processing": 1,
  "completed": 20,
  "failed": 1
}
```

**Changes Made**: Fixed table name from `voice_notes` to `notes` to match actual schema.

### 2. `get_system_processing_stats()` [NEW]

**Purpose**: Get system-wide processing statistics for administrative monitoring  
**Parameters**: None  
**Returns**: Global processing statistics across all users

```sql
SELECT * FROM get_system_processing_stats();
```

**Returns**:
```json
{
  "total": 1542,
  "pending": 23,
  "processing": 5,
  "completed": 1480,
  "failed": 34,
  "users_with_notes": 47,
  "avg_processing_time_minutes": 2.3,
  "error_rate": 2.2
}
```

**Fields**:
- `total` - Total number of notes in system
- `pending` - Notes waiting to be processed
- `processing` - Notes currently being processed
- `completed` - Successfully processed notes
- `failed` - Notes that failed processing
- `users_with_notes` - Number of unique users with notes
- `avg_processing_time_minutes` - Average time from upload to completion
- `error_rate` - Percentage of notes that failed processing

### 3. `get_system_health_stats()` [NEW]

**Purpose**: Quick system health check for monitoring  
**Parameters**: None  
**Returns**: System health overview with warnings

```sql
SELECT * FROM get_system_health_stats();
```

**Returns**:
```json
{
  "status": "HEALTHY",
  "total_notes": 1542,
  "stuck_processing": 0,
  "recent_errors": 2,
  "system_healthy": true
}
```

**Fields**:
- `status` - "HEALTHY", "WARNING: Stuck processing detected", or "WARNING: High error rate"
- `total_notes` - Total notes in system
- `stuck_processing` - Notes stuck processing for >10 minutes
- `recent_errors` - Errors in the last hour
- `system_healthy` - Boolean indicating overall health

**Health Logic**:
- ⚠️ Stuck processing: Notes processing for >10 minutes
- ⚠️ High error rate: >5 errors in the last hour
- ✅ Healthy: No stuck processing and ≤5 recent errors

## Usage in Scripts

### Before (Problematic)
```typescript
// This would fail because get_processing_stats requires user_id
const { data, error } = await supabase.rpc('get_processing_stats');
```

### After (Fixed)
```typescript
// For administrative/system monitoring:
const { data, error } = await supabase.rpc('get_system_processing_stats');

// For quick health checks:
const { data, error } = await supabase.rpc('get_system_health_stats');

// For user-specific stats (still works as before):
const { data, error } = await supabase.rpc('get_processing_stats', { 
  p_user_id: userId 
});
```

## Updated Scripts

The following scripts have been updated to use the new system functions:

1. **`scripts/reset-vercel-state.ts`** - Now uses `get_system_processing_stats()`
2. **`scripts/emergency-vercel-fix.ts`** - Now uses `get_system_processing_stats()`
3. **`scripts/test-vercel-deployment.ts`** - Now uses `get_system_processing_stats()`
4. **`scripts/quick-migration-apply.ts`** - Now uses `get_system_processing_stats()`

## Testing

Run the test script to verify all functions work correctly:

```bash
npx tsx scripts/test-system-processing-stats.ts
```

This script tests:
- ✅ System processing stats function
- ✅ System health stats function  
- ✅ User processing stats function (with sample data)
- ✅ Data validation and field presence
- ✅ Type checking and ranges

## Migration

The new functions are added in migration `20240121_add_system_processing_stats.sql`.

**To apply**:
```sql
-- Apply the migration
\i supabase/migrations/20240121_add_system_processing_stats.sql
```

**To verify**:
```sql
-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('get_system_processing_stats', 'get_system_health_stats');

-- Test system stats
SELECT * FROM get_system_processing_stats();
SELECT * FROM get_system_health_stats();
```

## Benefits

1. **🔧 Administrative Monitoring**: System-wide stats without user context
2. **⚡ Health Checks**: Quick status overview for monitoring systems
3. **🛠️ Script Compatibility**: Fixes scripts that were failing due to missing parameters
4. **🎯 Targeted Alerts**: Health function provides clear status indicators
5. **📊 Rich Metrics**: Additional fields like error rates and processing times
6. **🔒 Secure**: Functions use `SECURITY DEFINER` for proper permissions

## Monitoring Integration

These functions are perfect for:

- **Dashboard widgets** showing system health
- **Automated alerts** when `system_healthy = false`
- **Performance monitoring** tracking `avg_processing_time_minutes`
- **Capacity planning** using `users_with_notes` and growth trends
- **Error tracking** monitoring `error_rate` and `recent_errors`

## Backward Compatibility

✅ **Fully backward compatible** - All existing code using `get_processing_stats(user_id)` continues to work unchanged.

❌ **Scripts calling without parameters** - These were broken before and are now fixed to use the appropriate system function. 