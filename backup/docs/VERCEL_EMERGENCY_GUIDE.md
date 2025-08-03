# Vercel Emergency Deployment Guide

## 🚨 IMMEDIATE ACTION REQUIRED

Your Vercel deployment is not processing notes. This guide provides immediate fixes for the most common issues.

## ⚡ Quick Fix (5 minutes)

```bash
# Run the emergency fix script
npm run script scripts/emergency-vercel-fix.ts

# If that fails, try the migration-only fix
npm run script scripts/quick-migration-apply.ts

# Verify the fix worked
npm run script scripts/test-vercel-deployment.ts
```

## 🔍 Quick Diagnosis

Run these commands to identify the problem:

```bash
# Check environment variables
echo "Supabase URL: ${NEXT_PUBLIC_SUPABASE_URL:0:20}..."
echo "Service Key: ${SUPABASE_SERVICE_KEY:0:10}..."
echo "OpenAI Key: ${OPENAI_API_KEY:0:10}..."
echo "Cron Secret: ${CRON_SECRET:0:10}..."

# Test database connection
npm run script scripts/simple-db-check.ts

# Check migration status
npm run script scripts/simple-migration-check.ts
```

## 🎯 Root Cause: Missing Migration

The most likely issue is that the critical database migration `20240119_add_error_tracking.sql` has **NOT been applied** to your production database. This migration adds:

- Error tracking columns (`error_message`, `processing_attempts`, `last_error_at`)
- Database functions for processing stats
- Enhanced error handling capabilities

**Without this migration, all note processing will fail.**

## 📋 Environment Variable Checklist

Verify these are set in your Vercel dashboard:

### Required Variables
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- ✅ `SUPABASE_SERVICE_KEY` - Service role key (starts with `eyJ`)
- ✅ `OPENAI_API_KEY` - OpenAI API key (starts with `sk-`)
- ✅ `CRON_SECRET` - Random secret for cron job authentication

### Optional Variables
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key for client-side auth
- `VERCEL_URL` - Automatically set by Vercel
- `NEXT_PUBLIC_APP_URL` - Your custom domain (if using)

## 🔧 Migration Fix Procedures

### Option 1: Automated Fix (Recommended)

```bash
# This script will attempt multiple methods to apply the migration
npm run script scripts/quick-migration-apply.ts
```

### Option 2: Manual Fix via Supabase Dashboard

If automated fix fails:

1. **Go to Supabase Dashboard** → Your Project → SQL Editor
2. **Copy the migration SQL** from `supabase/migrations/20240119_add_error_tracking.sql`
3. **Paste and execute** the entire SQL in the editor
4. **Verify success** by running:
   ```bash
   npm run script scripts/test-vercel-deployment.ts
   ```

### Option 3: Emergency Manual SQL

If you can't access the migration file, execute this SQL in Supabase:

```sql
-- Add error tracking columns
ALTER TABLE voice_notes 
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS processing_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMP WITH TIME ZONE;

-- Create processing stats function
CREATE OR REPLACE FUNCTION get_processing_stats()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'total', (SELECT COUNT(*) FROM voice_notes),
    'pending', (SELECT COUNT(*) FROM voice_notes WHERE status = 'pending'),
    'processing', (SELECT COUNT(*) FROM voice_notes WHERE status = 'processing'),
    'completed', (SELECT COUNT(*) FROM voice_notes WHERE status = 'completed'),
    'error', (SELECT COUNT(*) FROM voice_notes WHERE status = 'error')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 🌐 Vercel-Specific Troubleshooting

### Function Timeout Issues
If functions are timing out:

1. **Check function duration** in Vercel dashboard
2. **Increase timeout** in `vercel.json`:
   ```json
   {
     "functions": {
       "app/api/process/route.ts": {
         "maxDuration": 300
       }
     }
   }
   ```

### Environment Variable Problems
1. **Redeploy after changes** - Vercel requires redeployment for env var changes
2. **Check variable names** - They're case-sensitive
3. **Verify no trailing spaces** - Copy-paste can add invisible characters

### Cron Job Failures
1. **Verify CRON_SECRET** is set correctly
2. **Check cron configuration** in `vercel.json`:
   ```json
   {
     "crons": [{
       "path": "/api/process/batch",
       "schedule": "0 0 * * *"
     }]
   }
   ```
   **Note:** Hobby plan is limited to daily execution. For 5-minute processing, upgrade to Pro plan.

## ✅ Verification Steps

After applying any fix:

1. **Run full test suite**:
   ```bash
   npm run script scripts/test-vercel-deployment.ts
   ```

2. **Check specific functions**:
   ```bash
   # Test API endpoints
   curl https://your-app.vercel.app/api/health
   
   # Test cron endpoint
   curl -X POST https://your-app.vercel.app/api/process/batch \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

3. **Monitor processing**:
   ```bash
   npm run script scripts/monitor-processing-health.ts
   ```

## 🚨 Emergency Escalation

If the standard fixes don't work:

### Immediate Actions
1. **Check Vercel status** - [status.vercel.com](https://status.vercel.com)
2. **Check Supabase status** - [status.supabase.com](https://status.supabase.com)
3. **Review Vercel function logs** in dashboard

### Advanced Diagnostics
```bash
# Comprehensive health check
npm run script scripts/production-health-check.ts

# Detailed processing diagnosis
npm run script scripts/diagnose-production-issues.ts

# Reset entire system state
npm run script scripts/reset-vercel-state.ts
```

### Manual Processing
As a last resort, manually process stuck notes:
```bash
npm run script scripts/manual-process.ts
```

## 📊 Common Error Messages

### "Column doesn't exist" errors
- **Cause**: Migration not applied
- **Fix**: Run migration scripts above

### "Function timeout" errors
- **Cause**: Vercel function limits
- **Fix**: Increase timeout in `vercel.json`

### "Authentication failed" errors
- **Cause**: Incorrect CRON_SECRET
- **Fix**: Verify environment variable

### "Cannot connect to database" errors
- **Cause**: Supabase credentials issue
- **Fix**: Verify Supabase keys

## 🎯 Success Indicators

Your deployment is working when:
- ✅ All tests pass in `test-vercel-deployment.ts`
- ✅ Health endpoint returns 200
- ✅ New uploads get processed within 5 minutes
- ✅ No errors in Vercel function logs
- ✅ Processing stats show active processing

## 💡 Prevention

To prevent future issues:
1. **Monitor regularly** with health checks
2. **Test migrations** in staging first  
3. **Keep environment variables** documented
4. **Use the emergency scripts** for regular health checks

---

**Need immediate help?** Run the emergency fix script and follow the output:
```bash
npm run script scripts/emergency-vercel-fix.ts
``` 