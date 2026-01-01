# Voice Memory - Quick Deployment Guide

Complete production deployment in under 30 minutes.

## Prerequisites Checklist

Before you begin, have these ready:

- [ ] Supabase account created
- [ ] OpenAI account with API access
- [ ] Vercel account connected to GitHub
- [ ] Code pushed to GitHub repository
- [ ] Terminal/command line access

---

## Step 1: Generate Secrets (2 minutes)

Generate secure random secrets for production:

```bash
# In your project directory
npm run generate-secrets
```

**Save the output** - you'll need these values in Step 4.

Expected output:
```
JWT_SECRET=abc123...
CRON_SECRET=def456...
```

---

## Step 2: Supabase Setup (10 minutes)

### 2.1 Create Project
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click **"New Project"**
3. Fill in project details and create

### 2.2 Run Database Migrations
1. Go to **SQL Editor** in Supabase
2. Open a new query
3. Run migration files in order from `supabase/migrations/`:
   - `20240118_initial_schema.sql`
   - `20240118_processing_queue.sql`
   - `20240118_row_level_security.sql`
   - `20240119_add_error_tracking.sql`
   - `20240120_add_processing_lock.sql`
   - And all subsequent migration files

### 2.3 Create Storage Bucket
1. Go to **Storage**
2. Click **"New bucket"**
3. Name: `audio-files`
4. Set to **Public**
5. Click **"Create bucket"**

### 2.4 Configure Authentication
1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: `https://voice-memory-tau.vercel.app` (or your domain)
3. Add **Redirect URLs**:
   ```
   https://voice-memory-tau.vercel.app/auth/callback
   https://*.vercel.app/auth/callback
   http://localhost:3000/auth/callback
   ```
4. Save changes

### 2.5 Collect API Keys
1. Go to **Settings** → **API**
2. Copy these values (you'll need them in Step 4):
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY`
   - **JWT Secret** → `SUPABASE_JWT_SECRET`

---

## Step 3: OpenAI Setup (2 minutes)

1. Go to [OpenAI Platform](https://platform.openai.com)
2. Navigate to **API Keys**
3. Click **"Create new secret key"**
4. Copy the key → `OPENAI_API_KEY`
5. Ensure billing is set up

---

## Step 4: Vercel Deployment (15 minutes)

### 4.1 Import Project
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"New Project"**
3. Import your GitHub repository
4. Framework: **Next.js** (auto-detected)

### 4.2 Configure Environment Variables

**CRITICAL**: Before deploying, add all environment variables.

Go to: **Settings** → **Environment Variables**

Add these for **Production** environment:

```bash
# === REQUIRED - Authentication & Database ===
NEXT_PUBLIC_SUPABASE_URL=<from-supabase-step-2.5>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-supabase-step-2.5>
SUPABASE_SERVICE_KEY=<from-supabase-step-2.5>
SUPABASE_JWT_SECRET=<from-supabase-step-2.5>

# === REQUIRED - AI Services ===
OPENAI_API_KEY=<from-openai-step-3>

# === REQUIRED - Security ===
CRON_SECRET=<from-step-1-generate-secrets>
JWT_SECRET=<from-step-1-generate-secrets>

# === REQUIRED - URLs & CORS ===
NEXT_PUBLIC_APP_URL=https://voice-memory-tau.vercel.app
CORS_ORIGINS=https://voice-memory-tau.vercel.app

# === RUNTIME ===
NODE_ENV=production
VERCEL_ENV=production

# === RECOMMENDED - Performance ===
BATCH_SIZE=5
PROCESSING_TIMEOUT_MINUTES=14
USE_DATABASE_RATE_LIMITING=true
OPENAI_WHISPER_MODEL=whisper-1
OPENAI_GPT_MODEL=gpt-4-turbo-preview
NEXT_PUBLIC_MAX_FILE_SIZE=25000000
NEXT_TELEMETRY_DISABLED=1
```

**Important**: Replace placeholders with actual values!

### 4.3 Configure Cron Jobs
1. Go to **Settings** → **Cron Jobs**
2. Verify the cron job exists:
   - Path: `/api/process/batch`
   - Schedule: `0 0 * * *` (daily at midnight)
3. If not present, click **"Add Cron Job"** and configure

### 4.4 Deploy
1. Click **"Deploy"**
2. Wait for build to complete (2-5 minutes)
3. Click on the deployment URL to view your app

---

## Step 5: Verify Deployment (5 minutes)

### 5.1 Automated Verification

Run the verification script:

```bash
npm run verify-deployment https://voice-memory-tau.vercel.app
```

This checks:
- ✅ Health endpoint
- ✅ Security headers
- ✅ HTTPS enforcement
- ✅ CORS configuration
- ✅ API endpoints

### 5.2 Manual Testing

#### Test 1: Health Check
Visit: `https://your-domain.vercel.app/api/health`

Expected: `{"status":"healthy"}`

#### Test 2: Authentication Flow
1. Go to your deployment URL
2. Click **"Login"**
3. Enter your email
4. Check email for magic link
5. Click link → Should redirect to `/auth/callback` → Land on homepage authenticated

#### Test 3: File Upload
1. While authenticated, click **"Upload"**
2. Select a small audio file (< 5MB)
3. Verify upload succeeds
4. Wait for transcription to complete
5. Check that analysis appears

---

## Troubleshooting

### Auth Not Working
**Symptoms**: Magic link doesn't work, or redirects fail

**Fix**:
1. Verify `NEXT_PUBLIC_APP_URL` matches your actual domain
2. Check Supabase redirect URLs include your domain
3. Ensure both use HTTPS in production

### CORS Errors
**Symptoms**: API calls fail with CORS error in browser console

**Fix**:
1. Verify `CORS_ORIGINS` exactly matches `NEXT_PUBLIC_APP_URL`
2. Check `vercel.json` has correct domain (not wildcard)
3. Redeploy after fixing

### Upload Fails
**Symptoms**: File upload errors or processing stuck

**Fix**:
1. Verify `OPENAI_API_KEY` is valid and has credits
2. Check Supabase storage bucket `audio-files` exists and is public
3. Verify `SUPABASE_SERVICE_KEY` is correct

### Processing Not Running
**Symptoms**: Files stuck in "processing" state

**Fix**:
1. Check Vercel function logs for errors
2. Verify all database migrations ran successfully
3. Check `PROCESSING_TIMEOUT_MINUTES` is set to 14
4. Manually trigger: Click "Process" button in UI

### Build Fails
**Symptoms**: Deployment fails during build

**Fix**:
1. Check all environment variables are set
2. Verify no TypeScript errors locally: `npm run typecheck`
3. Check Vercel build logs for specific error
4. Try deploying from local: `vercel --prod`

---

## Post-Deployment

### Update Supabase URLs (If Domain Changes)
If you add a custom domain:
1. Update `NEXT_PUBLIC_APP_URL` in Vercel
2. Update `CORS_ORIGINS` in Vercel
3. Add new domain to Supabase redirect URLs
4. Redeploy

### Monitor Your App
1. **Vercel Dashboard**: Check function logs, errors, and performance
2. **Supabase Dashboard**: Monitor database usage, auth activity
3. **OpenAI Dashboard**: Track API usage and costs

### Regular Maintenance
- Rotate secrets every 90 days
- Update dependencies monthly
- Monitor error rates and performance
- Backup database regularly

---

## Quick Reference

### Important URLs
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com
- **OpenAI Platform**: https://platform.openai.com

### Useful Commands
```bash
# Generate new secrets
npm run generate-secrets

# Verify deployment
npm run verify-deployment <url>

# Check local environment
npm run typecheck
npm run build

# Run tests
npm test
npm run test:e2e
```

### Documentation
- **Complete guide**: See `DEPLOYMENT.md`
- **Environment variables**: See `ENVIRONMENT_VARIABLES.md`
- **Troubleshooting**: See `DEPLOYMENT.md` Section 8

---

## Success Criteria

Your deployment is successful when:

- ✅ Health check returns `{"status":"healthy"}`
- ✅ You can login with magic link
- ✅ File upload works
- ✅ Transcription completes
- ✅ AI analysis appears
- ✅ No CORS errors in browser console
- ✅ No errors in Vercel function logs

---

## Need Help?

1. Run verification script: `npm run verify-deployment <url>`
2. Check Vercel deployment logs
3. Check Supabase logs
4. Review `DEPLOYMENT.md` troubleshooting section
5. Verify all environment variables are set correctly

---

**Total Time**: ~30 minutes
**Difficulty**: Medium
**Prerequisites**: Basic command line knowledge

🎉 **Congratulations!** Your Voice Memory app is now live in production!
