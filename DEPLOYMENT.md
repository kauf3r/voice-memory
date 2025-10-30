# Voice Memory - Deployment Guide

This guide covers deploying Voice Memory to Vercel with Supabase and OpenAI integration.

## Prerequisites

1. **Supabase Account** - [supabase.com](https://supabase.com)
2. **OpenAI Account** - [platform.openai.com](https://platform.openai.com)
3. **Vercel Account** - [vercel.com](https://vercel.com)
4. **GitHub Account** - Code repository

## ⚠️ Plan Considerations

**Processing Frequency by Vercel Plan:**
- **Hobby (Free)**: Daily processing only (up to 24-hour delay)
- **Pro ($20/month)**: 5-minute processing intervals
- **Enterprise**: Custom frequency

**Current app configuration is optimized for Hobby plan users.** Manual processing is always available through the UI for immediate needs.

## 1. Supabase Setup

### Create Project
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose organization and fill project details
4. Wait for project to initialize (2-3 minutes)

### Database Setup
1. Go to **SQL Editor** in Supabase dashboard
2. Run the migration files in order:
   ```sql
   -- Run these files from supabase/migrations/
   -- 1. 20240118_initial_schema.sql
   -- 2. 20240118_processing_queue.sql  
   -- 3. 20240118_row_level_security.sql
   ```
3. Run the quota management tables:
   ```sql
   -- Run lib/database-migrations.sql
   ```

### Storage Setup
1. Go to **Storage** in Supabase dashboard
2. Create a new bucket named `audio-files`
3. Set bucket to **Public** (for audio playback)
4. Configure bucket policies as needed

### Authentication Setup
1. Go to **Authentication** → **URL Configuration**
2. Configure **Site URL**: `https://your-domain.vercel.app`
3. Add **Redirect URLs** (one per line):
   ```
   https://your-domain.vercel.app/auth/callback
   https://*.vercel.app/auth/callback
   http://localhost:3000/auth/callback
   ```
4. Go to **Authentication** → **Providers**
5. Enable **Email** provider (Magic Links)

⚠️ **Important**: The Site URL and redirect URLs must match `NEXT_PUBLIC_APP_URL` in Vercel exactly

### Get API Keys
1. Go to **Settings** → **API**
2. Copy these values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY`
   - `JWT Secret` → `SUPABASE_JWT_SECRET` (under JWT Settings section)

## 2. OpenAI Setup

1. Go to [OpenAI Platform](https://platform.openai.com)
2. Navigate to **API Keys**
3. Create a new secret key
4. Copy the key → `OPENAI_API_KEY`
5. Ensure you have sufficient credits/billing set up

## 3. Vercel Deployment

### Option A: GitHub Integration (Recommended)

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Click **"New Project"**
4. Import your GitHub repository
5. Configure project:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from project directory
vercel

# Follow prompts to configure project
```

### Environment Variables

⚠️ **CRITICAL**: All required variables must be set for the app to work properly.

In Vercel dashboard → **Settings** → **Environment Variables**, add these for **Production** environment:

```bash
# === REQUIRED - Authentication & Database ===
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key-from-supabase]
SUPABASE_SERVICE_KEY=[service-role-key-from-supabase]
SUPABASE_JWT_SECRET=[jwt-secret-from-supabase]

# === REQUIRED - AI Services ===
OPENAI_API_KEY=sk-[your-openai-key]

# === REQUIRED - Security ===
# Generate these with: openssl rand -hex 32
CRON_SECRET=[generate-32-char-random-string]
JWT_SECRET=[generate-32-char-random-string]

# === REQUIRED - URLs & CORS ===
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
CORS_ORIGINS=https://your-domain.vercel.app

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

**How to generate secrets:**
```bash
# Generate CRON_SECRET
openssl rand -hex 32

# Generate JWT_SECRET
openssl rand -hex 32
```

📖 **For complete environment variable reference**, see [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)

### Domain Configuration

1. Go to **Settings** → **Domains**
2. Add your custom domain (optional)
3. Configure DNS settings as instructed
4. Update Supabase redirect URLs with new domain

## 4. Cron Job Configuration

### Setup Cron Authentication

1. Go to Vercel Dashboard → Your Project → **Settings** → **Cron Jobs**
2. Verify the cron job exists:
   - **Path**: `/api/process/batch`
   - **Schedule**: `0 0 * * *` (daily at midnight)
3. Vercel automatically adds auth headers to cron requests
4. The CRON_SECRET you set will validate these requests

⚠️ **Note**: Hobby plan supports daily cron jobs only. Upgrade to Pro for 5-minute intervals.

## 5. Post-Deployment Verification

### Quick Verification Checklist

Run through these checks after deployment:

#### 1. Health Check
```bash
curl https://your-domain.vercel.app/api/health
```
**Expected response**: `{"status":"healthy"}`

#### 2. Authentication Flow Test
1. Go to your deployed app homepage
2. Click "Login" button
3. Enter your email address
4. Check email for magic link
5. Click magic link
6. Verify you're redirected to `/auth/callback`
7. Confirm you land back on homepage as authenticated user

**If auth fails**:
- Check Supabase redirect URLs match your domain
- Verify NEXT_PUBLIC_APP_URL is set correctly
- Check browser console for CORS errors

#### 3. CORS Verification
1. Open browser DevTools → Console
2. Login and navigate around the app
3. Check for any CORS-related errors
4. If you see CORS errors:
   - Verify CORS_ORIGINS matches your domain exactly
   - Check vercel.json has correct Access-Control-Allow-Origin
   - Redeploy after fixing

#### 4. File Upload Test
1. Go to homepage (while authenticated)
2. Click upload button
3. Select a small audio file (< 5MB for testing)
4. Verify upload succeeds
5. Check that processing starts
6. Wait for transcription and analysis to complete

**If upload fails**:
- Check file size limits (NEXT_PUBLIC_MAX_FILE_SIZE)
- Verify Supabase storage bucket exists and is public
- Check OPENAI_API_KEY is valid and has credits

#### 5. Cron Job Verification
1. Go to Vercel Dashboard → Deployments → Functions
2. Find the `/api/process/batch` function
3. Check logs for any errors
4. Verify CRON_SECRET authentication succeeds

**If cron fails**:
- Verify CRON_SECRET is set in environment variables
- Check that Vercel cron job is configured
- Review function logs for specific errors

### Detailed Verification

### Database Setup Verification
Run this query in Supabase SQL Editor to verify tables:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

Should return: `users`, `notes`, `project_knowledge`, `api_usage`, `processing_attempts`

### Monitoring Setup

1. **Vercel Analytics**: Enable in project settings
2. **Error Tracking**: Configure Sentry (optional)
3. **Performance**: Monitor via Vercel dashboard

## 6. Production Checklist

### Security
- [ ] All required environment variables configured (see ENVIRONMENT_VARIABLES.md)
- [ ] SUPABASE_JWT_SECRET set from Supabase dashboard
- [ ] JWT_SECRET generated and set (32+ characters)
- [ ] CRON_SECRET generated and set (32+ characters)
- [ ] RLS policies enabled in Supabase
- [ ] Service role key secured (never exposed client-side)
- [ ] CORS configured properly (CORS_ORIGINS set, no wildcards)
- [ ] CSP headers configured (check next.config.js)
- [ ] HTTPS enforced (Strict-Transport-Security header)
- [ ] Supabase redirect URLs match NEXT_PUBLIC_APP_URL

### Performance  
- [ ] Images optimized
- [ ] Caching headers configured
- [ ] Bundle size analyzed
- [ ] Database indexes added

### Monitoring
- [ ] Health check endpoint working
- [ ] Error boundaries in place
- [ ] Analytics enabled
- [ ] Logging configured

### Testing
- [ ] Upload functionality
- [ ] Audio transcription
- [ ] AI analysis
- [ ] User authentication
- [ ] Mobile responsiveness

## 7. Scaling Considerations

### Database
- Monitor Supabase usage
- Consider upgrading plan for higher limits
- Add database indexes for performance

### API Limits
- Monitor OpenAI usage and costs
- Implement rate limiting if needed
- Consider caching strategies

### Storage
- Monitor Supabase storage usage
- Implement cleanup strategies for old files
- Consider CDN for better performance

## 8. Troubleshooting

### Common Issues

**Build Failures**
```bash
# Clear dependencies and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run typecheck
```

**Database Connection Issues**
- Verify Supabase URL and keys
- Check RLS policies
- Ensure migrations ran successfully

**Authentication Issues**
- Verify redirect URLs in Supabase
- Check CORS settings
- Ensure site URL matches deployment

**API Errors**
- Check OpenAI API key and credits
- Verify quota management setup
- Check function timeout limits

### Debug Commands

```bash
# Check health endpoint
curl https://your-domain.vercel.app/health

# Analyze bundle size
npm run build:analyze

# Run tests
npm test

# Type checking
npm run typecheck
```

## 9. Maintenance

### Regular Tasks
- Monitor error rates and performance
- Review and rotate API keys quarterly
- Update dependencies monthly
- Backup database regularly

### Updates
- Follow semantic versioning
- Test in staging environment first
- Monitor deployment for issues
- Keep dependencies updated

---

## Support

For issues:
1. Check the troubleshooting section
2. Review Vercel deployment logs
3. Check Supabase logs
4. Verify environment variables

## Links

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)# Trigger rebuild Tue Jul 22 08:53:58 PDT 2025
