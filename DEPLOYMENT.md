# Voice Memory - Deployment Guide

This guide covers deploying Voice Memory to Vercel with Supabase and OpenAI integration.

## Prerequisites

1. **Supabase Account** - [supabase.com](https://supabase.com)
2. **OpenAI Account** - [platform.openai.com](https://platform.openai.com)
3. **Vercel Account** - [vercel.com](https://vercel.com)
4. **GitHub Account** - Code repository

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
1. Go to **Authentication** → **Settings**
2. Configure **Site URL**: `https://your-domain.vercel.app`
3. Add **Redirect URLs**:
   - `https://your-domain.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for development)
4. Enable **Magic Links** in Auth providers

### Get API Keys
1. Go to **Settings** → **API**
2. Copy these values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY`

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

In Vercel dashboard → **Settings** → **Environment Variables**, add:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_KEY=[service-key]
OPENAI_API_KEY=sk-[your-key]

# Optional
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

### Domain Configuration

1. Go to **Settings** → **Domains**
2. Add your custom domain (optional)
3. Configure DNS settings as instructed
4. Update Supabase redirect URLs with new domain

## 4. Post-Deployment

### Verify Deployment
1. Visit your deployed app
2. Check `/health` endpoint: `https://your-domain.vercel.app/health`
3. Test user registration/login
4. Upload a test audio file
5. Verify processing works

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

## 5. Production Checklist

### Security
- [ ] Environment variables configured
- [ ] RLS policies enabled in Supabase
- [ ] Service role key secured
- [ ] CORS configured properly

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

## 6. Scaling Considerations

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

## 7. Troubleshooting

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

## 8. Maintenance

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
