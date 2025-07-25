# Vercel Deployment Guide - Voice Memory

This guide covers how to properly configure environment variables and deploy the Voice Memory application to Vercel.

## 🔧 Environment Variables Setup

### Required Variables

These environment variables **must** be set in your Vercel project for the application to function properly:

| Variable | Description | Example | Where to Get |
|----------|-------------|---------|--------------|
| `OPENAI_API_KEY` | OpenAI API key for Whisper transcription and GPT analysis | `sk-proj-...` | [OpenAI API Keys](https://platform.openai.com/api-keys) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbGciOiJ...` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJhbGciOiJ...` | Supabase Dashboard → Settings → API |
| `CRON_SECRET` | Secret key for authenticating cron requests | 32+ character random string | Generate with `openssl rand -base64 32` |

### Optional Variables

These variables have default values but can be customized:

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `OPENAI_WHISPER_MODEL` | Whisper model for transcription | `whisper-1` | Use latest stable model |
| `OPENAI_GPT_MODEL` | GPT model for analysis | `gpt-4-turbo-preview` | Choose based on your OpenAI plan |
| `BATCH_SIZE` | Notes to process per batch | `5` | Adjust based on processing capacity |
| `OPENAI_WHISPER_RATE_LIMIT` | Whisper API requests per minute | `50` | Match your OpenAI plan limits |
| `OPENAI_GPT_RATE_LIMIT` | GPT API requests per minute | `200` | Match your OpenAI plan limits |

## 🚀 Deployment Steps

### 1. Verify Local Configuration

First, ensure your local environment is working:

```bash
# Run the verification script
npx tsx scripts/verify-vercel-env.ts

# Test OpenAI connection
npx tsx scripts/verify-openai-key.ts
```

### 2. Configure Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `voice-memory` project
3. Navigate to **Settings** → **Environment Variables**
4. Add each required variable from the table above
5. Copy the exact values from your local `.env.local` file
6. Set all variables for **Production**, **Preview**, and **Development** environments

### 3. Deploy

After setting environment variables:

1. Go to the **Deployments** tab
2. Click the "..." menu on the latest deployment
3. Select **Redeploy** to use the new environment variables

Or trigger a new deployment by pushing to your main branch:

```bash
git push origin main
```

## 🔍 Troubleshooting

### Common Issues

#### OpenAI Authentication Errors
- **Symptom**: `401 Incorrect API key provided`
- **Solution**: Verify `OPENAI_API_KEY` is correctly set in Vercel
- **Check**: Ensure the key starts with `sk-proj-` and is not truncated

#### Supabase Connection Errors
- **Symptom**: Database connection failures
- **Solution**: Verify all Supabase variables are set correctly
- **Check**: URLs should not have trailing slashes

#### Cron Job Failures
- **Symptom**: Automated processing not working
- **Solution**: Ensure `CRON_SECRET` is set and matches the value in `vercel.json`
- **Check**: Secret should be 32+ characters long

### Verification Commands

```bash
# Check local environment
npx tsx scripts/verify-vercel-env.ts

# Test OpenAI API locally
npx tsx scripts/verify-openai-key.ts

# Check production deployment (after setting vars)
curl https://your-app.vercel.app/api/health
```

### Environment Variable Checklist

Use this checklist to ensure all variables are properly configured:

- [ ] `OPENAI_API_KEY` - Set in Vercel, valid API key
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Set in Vercel, correct project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Set in Vercel, valid anon key
- [ ] `SUPABASE_SERVICE_KEY` - Set in Vercel, valid service key
- [ ] `CRON_SECRET` - Set in Vercel, secure random string
- [ ] All variables set for Production environment
- [ ] Application redeployed after setting variables

## 📊 Monitoring

After deployment, monitor these aspects:

1. **Deployment Status**: Check Vercel dashboard for successful deployments
2. **Function Logs**: Monitor serverless function execution logs
3. **Processing Queue**: Verify notes are being processed automatically
4. **Error Rates**: Watch for authentication or API errors

## 🔒 Security Notes

- Never commit real API keys to version control
- Use strong, unique values for `CRON_SECRET`
- Regularly rotate API keys as needed
- Monitor API usage and costs
- Keep Supabase service keys secure

## 📈 Production Recommendations

For production deployments:

- Set `BATCH_SIZE` to 3-5 based on processing capacity
- Configure rate limits based on your OpenAI plan
- Enable database-backed rate limiting if needed
- Monitor OpenAI API usage and costs
- Set up error tracking and monitoring
- Consider implementing retry logic for failed requests

## 🔄 Updates and Maintenance

When updating environment variables:

1. Update variables in Vercel dashboard
2. Redeploy the application
3. Test functionality after deployment
4. Monitor logs for any issues
5. Update local `.env.local` file if needed

---

**Need Help?** Check the troubleshooting section above or review the application logs in your Vercel dashboard.