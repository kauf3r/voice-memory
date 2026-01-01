# Emergency Recovery Guide

**Voice Memory Processing System Recovery**

This guide provides step-by-step instructions for diagnosing and fixing critical issues when the Voice Memory note processing pipeline stops working.

## 🚨 Quick Diagnosis (2 minutes)

### 1. Check System Status
```bash
# Run the deployment verification script
npm run script scripts/verify-deployment-status.ts
```

### 2. Look for Common Symptoms
- ✅ **Notes uploading but not processing**: Database migration missing
- ✅ **Processing stuck for hours**: Stuck processing locks
- ✅ **All processing failing**: Environment variable issues
- ✅ **Intermittent failures**: Cron job authentication problems
- ✅ **Error messages in UI**: OpenAI API connectivity issues

### 3. Check Processing Queue
```bash
# Check current processing status in your application
# Look for notes with processing_started_at but no processed_at
```

## 🔧 Emergency Fix Procedures

### Option A: Automated Emergency Fix (Recommended)

**Prerequisites:**
- Node.js environment with project dependencies installed
- Environment variables configured (`.env.local`)
- Database admin access

**Steps:**
```bash
# 1. Run the comprehensive emergency fix
npm run script scripts/emergency-fix-processing.ts

# 2. Monitor the output for any failures
# The script will show ✅ or ❌ for each step

# 3. If successful, test by uploading a new note
# Processing should resume within 5 minutes
```

**What this script does:**
- ✅ Applies missing database migration (`20240119_add_error_tracking.sql`)
- ✅ Resets notes stuck in processing for >30 minutes
- ✅ Verifies all required environment variables
- ✅ Tests processing pipeline connectivity
- ✅ Validates cron endpoint authentication

### Option B: Manual Step-by-Step Fix

If the automated fix fails, follow these manual steps:

#### Step 1: Database Migration
```bash
# Check if error tracking columns exist
# In Supabase SQL Editor, run:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'notes' 
AND column_name IN ('error_message', 'processing_attempts', 'last_error_at');

# If missing, apply the migration:
# Copy contents of supabase/migrations/20240119_add_error_tracking.sql
# Execute in Supabase SQL Editor
```

#### Step 2: Reset Stuck Processing
```bash
# Run the stuck processing fix
npm run script scripts/fix-stuck-processing.ts

# Or manually in Supabase:
UPDATE notes 
SET processing_started_at = NULL 
WHERE processing_started_at < NOW() - INTERVAL '30 minutes' 
AND processed_at IS NULL;
```

#### Step 3: Environment Variables
Check these variables are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY`
- `CRON_SECRET`

#### Step 4: Test Processing
```bash
# Trigger manual batch processing
curl -X POST https://your-app.vercel.app/api/process/batch \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "x-vercel-cron: 1" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 1}'
```

## 🔍 Common Issues and Solutions

### Issue: Database Migration Missing

**Symptoms:**
- Processing fails with column errors
- "Column 'error_message' does not exist" errors

**Solution:**
```bash
# Quick fix
npm run script scripts/emergency-fix-processing.ts

# Manual fix
# Run the migration SQL in Supabase dashboard
```

### Issue: Processing Locks Stuck

**Symptoms:**
- Notes show "processing" for hours
- New notes not being processed
- Processing queue backing up

**Solution:**
```bash
# Automated fix
npm run script scripts/fix-stuck-processing.ts

# Manual fix in Supabase SQL Editor
UPDATE notes SET processing_started_at = NULL 
WHERE processing_started_at < NOW() - INTERVAL '15 minutes' 
AND processed_at IS NULL;
```

### Issue: Environment Variables Missing

**Symptoms:**
- 500 errors in processing
- Authentication failures
- OpenAI API errors

**Solution:**
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Add missing variables:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `CRON_SECRET`: Secret for cron authentication
   - `SUPABASE_SERVICE_KEY`: Supabase service role key
3. Redeploy the application

### Issue: Cron Job Not Running

**Symptoms:**
- Processing only works when triggered manually
- Notes accumulate without processing
- No automated batch processing

**Solution:**
```bash
# 1. Check vercel.json has cron configuration
cat vercel.json | grep -A 5 crons

# 2. Test cron endpoint manually
curl -X POST https://your-app.vercel.app/api/process/batch \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "x-vercel-cron: 1"

# 3. Check Vercel dashboard for cron execution logs
```

### Issue: OpenAI API Problems

**Symptoms:**
- Transcription or analysis failures
- Rate limit errors
- API connectivity errors

**Solution:**
```bash
# Check API key validity
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_API_KEY"

# Check rate limits in OpenAI dashboard
# Consider upgrading API plan if needed
```

## 🧪 Testing and Validation

### After Fix - Validation Steps

1. **Upload Test Note:**
   - Upload a short audio file through the UI
   - Note should appear as "pending" initially

2. **Monitor Processing:**
   - Check processing status in UI
   - Should complete within 2-3 minutes for short audio

3. **Verify Results:**
   - Transcription should appear
   - Analysis should be generated
   - Note marked as "completed"

4. **Check Automation:**
   - Wait 5 minutes for next cron cycle
   - Verify any remaining pending notes are processed

### Continuous Monitoring

```bash
# Run comprehensive health check
npm run script scripts/verify-deployment-status.ts

# Check processing queue status
npm run script scripts/fix-stuck-processing.ts
```

## 🚨 Rollback Procedures

### If Emergency Fix Causes Issues

1. **Database Rollback:**
```sql
-- Remove error tracking columns if they cause issues
ALTER TABLE notes 
DROP COLUMN IF EXISTS error_message,
DROP COLUMN IF EXISTS processing_attempts,
DROP COLUMN IF EXISTS last_error_at;

-- Drop processing_errors table
DROP TABLE IF EXISTS processing_errors;
```

2. **Reset Processing State:**
```sql
-- Clear all processing locks
UPDATE notes SET processing_started_at = NULL;
```

3. **Revert Environment:**
   - Remove any newly added environment variables
   - Redeploy from previous working commit

### Escalation Path

If the emergency fixes don't work:

1. **Check Vercel Deployment Status**
   - Verify deployment is active and healthy
   - Check function logs for errors

2. **Check Supabase Status**
   - Verify database is accessible
   - Check for service outages

3. **Check OpenAI Status**
   - Verify API key has credits
   - Check for service outages

4. **Contact Support**
   - Gather error logs and diagnostics
   - Include output from diagnostic scripts

## 📊 Prevention Strategies

### Regular Health Checks
```bash
# Weekly health check
npm run script scripts/verify-deployment-status.ts

# Daily stuck processing check
npm run script scripts/fix-stuck-processing.ts
```

### Monitoring Setup
- Set up alerts for processing failures
- Monitor processing queue length
- Track error rates and patterns

### Best Practices
- Always test changes in development first
- Keep backups of working configurations
- Document any custom modifications
- Monitor OpenAI API usage and limits

### Migration Safety
- Test migrations on development database first
- Keep rollback procedures ready
- Verify all dependent systems after migrations

## 📞 Emergency Contacts

### Internal Escalation
- **Developer**: Check application logs and recent deployments
- **DevOps**: Check infrastructure and deployment status
- **Database Admin**: Check Supabase status and migrations

### External Services
- **Vercel Support**: For deployment and cron issues
- **Supabase Support**: For database connectivity issues
- **OpenAI Support**: For API rate limits and service issues

## 📋 Recovery Checklist

### Emergency Response Checklist
- [ ] Run deployment verification script
- [ ] Check for obvious error patterns
- [ ] Run emergency fix script
- [ ] Verify database migration applied
- [ ] Reset stuck processing locks
- [ ] Test processing pipeline
- [ ] Validate cron endpoint
- [ ] Upload test note and verify processing
- [ ] Monitor for 30 minutes to ensure stability

### Post-Recovery Actions
- [ ] Document what went wrong
- [ ] Update monitoring/alerting if needed
- [ ] Review and improve prevention strategies
- [ ] Share learnings with team
- [ ] Schedule follow-up review

---

**Last Updated:** 2025-01-19  
**Version:** 1.0  
**Tested With:** Voice Memory v2.0+ with processing pipeline consolidation