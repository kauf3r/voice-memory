# Environment Variables Reference

Complete reference for all environment variables used in the Voice Memory application.

## Table of Contents

- [Required Variables](#required-variables)
- [Security Configuration](#security-configuration)
- [URL & CORS Configuration](#url--cors-configuration)
- [Optional Configuration](#optional-configuration)
- [Quick Start](#quick-start)
- [Production Deployment](#production-deployment)

---

## Required Variables

### Supabase Configuration

#### `NEXT_PUBLIC_SUPABASE_URL`
- **Required**: Yes
- **Type**: String (URL)
- **Example**: `https://abcdefghijklmnop.supabase.co`
- **Where to find**: Supabase Dashboard → Settings → API → Project URL
- **Description**: Your Supabase project URL. Must be publicly accessible.

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Required**: Yes
- **Type**: String (JWT)
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find**: Supabase Dashboard → Settings → API → Project API keys → anon public
- **Description**: Public anonymous key for client-side Supabase access. This key is safe to expose in the browser.

#### `SUPABASE_SERVICE_KEY`
- **Required**: Yes
- **Type**: String (JWT)
- **Sensitive**: ⚠️ NEVER expose this in client-side code
- **Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to find**: Supabase Dashboard → Settings → API → Project API keys → service_role secret
- **Description**: Service role key with admin privileges. Used for server-side operations only.

#### `SUPABASE_JWT_SECRET`
- **Required**: Yes
- **Type**: String
- **Sensitive**: ⚠️ NEVER expose this
- **Example**: `your-super-secret-jwt-secret-with-at-least-32-characters`
- **Where to find**: Supabase Dashboard → Settings → API → JWT Settings → JWT Secret
- **Description**: Used to verify JWT tokens from Supabase. Critical for authentication security.

### OpenAI Configuration

#### `OPENAI_API_KEY`
- **Required**: Yes
- **Type**: String
- **Sensitive**: ⚠️ NEVER expose this
- **Example**: `sk-proj-abc123...`
- **Where to find**: OpenAI Platform → API Keys
- **Description**: Your OpenAI API key for Whisper (transcription) and GPT (analysis) services.

---

## Security Configuration

### `CRON_SECRET`
- **Required**: Yes (for production)
- **Type**: String (32+ characters recommended)
- **Sensitive**: ⚠️ Keep private
- **Example**: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
- **How to generate**:
  ```bash
  # Option 1: Node.js
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

  # Option 2: OpenSSL
  openssl rand -hex 32

  # Option 3: Python
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
- **Description**: Secret key for authenticating cron job requests. Prevents unauthorized batch processing.

### `JWT_SECRET`
- **Required**: Yes (for production)
- **Type**: String (32+ characters minimum)
- **Sensitive**: ⚠️ Keep private
- **Example**: `x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9`
- **How to generate**: Same as CRON_SECRET above
- **Description**: Application-level JWT secret for internal token validation. Used by AppConfig.

---

## URL & CORS Configuration

### `NEXT_PUBLIC_APP_URL`
- **Required**: Yes (for production)
- **Type**: String (URL)
- **Example Production**: `https://voice-memory-tau.vercel.app`
- **Example Development**: `http://localhost:3000`
- **Description**: Your application's primary URL. Used for authentication redirects.
- **Important**:
  - Must match your Supabase redirect URLs
  - Used for magic link email redirects
  - Should be HTTPS in production

### `CORS_ORIGINS`
- **Required**: Yes (for production)
- **Type**: Comma-separated string of URLs
- **Example Single**: `https://voice-memory-tau.vercel.app`
- **Example Multiple**: `https://voice-memory.com,https://api.voice-memory.com`
- **Description**: Allowed origins for API requests. Prevents unauthorized access.
- **Rules**:
  - Production must be HTTPS only
  - No wildcards allowed
  - No localhost in production
  - Must match your actual domain(s)
- **Fallback**: If not set, uses `https://${VERCEL_URL}` in production

---

## Optional Configuration

### OpenAI Models

#### `OPENAI_WHISPER_MODEL`
- **Default**: `whisper-1`
- **Type**: String
- **Options**: `whisper-1` (latest stable)
- **Description**: Whisper model for audio transcription.

#### `OPENAI_GPT_MODEL`
- **Default**: `gpt-4o`
- **Type**: String
- **Options**:
  - `gpt-4o` - **RECOMMENDED** - Best quality/cost ratio ($5/$15 per 1M tokens)
  - `gpt-4o-mini` - Budget option, good for simple tasks ($0.15/$0.60 per 1M tokens)
  - `gpt-4-turbo` - Legacy, use gpt-4o instead ($10/$30 per 1M tokens)
- **Description**: GPT model for content analysis. GPT-4o offers same quality as GPT-4-turbo at 50% lower cost.

### Rate Limiting

#### `OPENAI_WHISPER_RATE_LIMIT`
- **Default**: `50`
- **Type**: Number
- **Description**: Maximum Whisper API requests per minute.

#### `OPENAI_WHISPER_MAX_CONCURRENT`
- **Default**: `5`
- **Type**: Number
- **Description**: Maximum concurrent Whisper API requests.

#### `OPENAI_GPT_RATE_LIMIT`
- **Default**: `200`
- **Type**: Number
- **Description**: Maximum GPT API requests per minute.

#### `OPENAI_GPT_MAX_CONCURRENT`
- **Default**: `10`
- **Type**: Number
- **Description**: Maximum concurrent GPT API requests.

#### `USE_DATABASE_RATE_LIMITING`
- **Default**: `false`
- **Type**: Boolean (`true` or `false`)
- **Description**: Enable database-backed rate limiting for better tracking across serverless functions.
- **Recommended**: `true` for production

### Processing Configuration

#### `BATCH_SIZE`
- **Default**: `5`
- **Type**: Number
- **Range**: 1-10
- **Recommended Production**: `3-5`
- **Description**: Number of voice notes to process in a single batch operation.

#### `PROCESSING_TIMEOUT_MINUTES`
- **Default**: `15`
- **Type**: Number
- **Recommended Production**: `14` (for 15-minute Vercel limit)
- **Description**: Maximum time allowed for processing a single note before timeout.

#### `NEXT_PUBLIC_MAX_FILE_SIZE`
- **Default**: `25000000` (25MB)
- **Type**: Number (bytes)
- **Description**: Maximum allowed audio file upload size.

#### `NEXT_PUBLIC_ALLOWED_AUDIO_TYPES`
- **Default**: `audio/mpeg,audio/mp4,audio/wav,audio/aac,audio/ogg,audio/webm`
- **Type**: Comma-separated string
- **Description**: Allowed MIME types for audio uploads.

### Retry Configuration

#### `OPENAI_RETRY_ATTEMPTS`
- **Default**: `3`
- **Type**: Number
- **Description**: Number of retry attempts for failed OpenAI API calls.

#### `OPENAI_RETRY_BASE_DELAY`
- **Default**: `1000`
- **Type**: Number (milliseconds)
- **Description**: Base delay between retry attempts.

#### `OPENAI_RETRY_MAX_DELAY`
- **Default**: `10000`
- **Type**: Number (milliseconds)
- **Description**: Maximum delay between retry attempts.

### Runtime Configuration

#### `NODE_ENV`
- **Default**: `development`
- **Type**: String
- **Options**: `development`, `production`, `test`
- **Description**: Node.js environment mode.

#### `VERCEL_ENV`
- **Auto-set by Vercel**: Yes
- **Type**: String
- **Options**: `production`, `preview`, `development`
- **Description**: Vercel deployment environment.

#### `NEXT_TELEMETRY_DISABLED`
- **Default**: Not set
- **Type**: Boolean (`1` to disable)
- **Example**: `1`
- **Description**: Disable Next.js anonymous telemetry.

---

## Quick Start

### Development Setup

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env.local
   ```

2. **Set required variables:**
   ```bash
   # Supabase (from Supabase Dashboard)
   NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_KEY=eyJ...
   SUPABASE_JWT_SECRET=your-jwt-secret

   # OpenAI (from OpenAI Platform)
   OPENAI_API_KEY=sk-proj-...

   # Security (generate random strings)
   CRON_SECRET=$(openssl rand -hex 32)
   JWT_SECRET=$(openssl rand -hex 32)

   # URLs (for development)
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   CORS_ORIGINS=http://localhost:3000
   ```

3. **Start development server:**
   ```bash
   npm install
   npm run dev
   ```

---

## Production Deployment

### Step 1: Gather Required Values

Before deploying, collect these values:

- [ ] **Supabase URL** (from Supabase Dashboard)
- [ ] **Supabase Anon Key** (from Supabase Dashboard)
- [ ] **Supabase Service Key** (from Supabase Dashboard)
- [ ] **Supabase JWT Secret** (from Supabase Dashboard → Settings → API)
- [ ] **OpenAI API Key** (from OpenAI Platform)
- [ ] **Production Domain** (your Vercel URL)

### Step 2: Generate Secrets

```bash
# Generate CRON_SECRET
openssl rand -hex 32

# Generate JWT_SECRET
openssl rand -hex 32
```

Save these securely!

### Step 3: Configure Vercel Environment Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these variables (select "Production" environment):

```bash
# === REQUIRED - Authentication & Database ===
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret-from-dashboard
OPENAI_API_KEY=sk-proj-...

# === REQUIRED - Security ===
CRON_SECRET=<generated-32-char-secret>
JWT_SECRET=<generated-32-char-secret>

# === REQUIRED - URLs ===
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
OPENAI_GPT_MODEL=gpt-4o
NEXT_PUBLIC_MAX_FILE_SIZE=25000000
NEXT_TELEMETRY_DISABLED=1
```

### Step 4: Configure Supabase Redirect URLs

Go to Supabase Dashboard → Authentication → URL Configuration

**Set Site URL:**
```
https://voice-memory-tau.vercel.app
```

**Add Redirect URLs (one per line):**
```
https://voice-memory-tau.vercel.app/auth/callback
https://*.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

### Step 5: Deploy

```bash
git add .
git commit -m "🔒 Configure production environment variables"
git push origin main
```

Or redeploy via Vercel Dashboard → Deployments → Redeploy

### Step 6: Verify

1. **Health Check**: Visit `https://your-domain.vercel.app/api/health`
   - Expected: `{"status":"healthy"}`

2. **Auth Flow Test**:
   - Go to homepage
   - Click login
   - Check email for magic link
   - Verify redirect works
   - Confirm authentication succeeds

3. **Upload Test**:
   - Upload a small audio file
   - Verify processing starts
   - Check for any errors in browser console

4. **Cron Job Test**:
   - Go to Vercel → Deployments → Functions
   - Check cron job logs
   - Verify no authentication errors

---

## Troubleshooting

### Common Issues

#### "Invalid JWT Secret"
- **Problem**: SUPABASE_JWT_SECRET not set or incorrect
- **Solution**: Get the correct value from Supabase Dashboard → Settings → API → JWT Secret

#### "CORS Error"
- **Problem**: CORS_ORIGINS not matching your actual domain
- **Solution**: Ensure CORS_ORIGINS exactly matches NEXT_PUBLIC_APP_URL

#### "Auth Redirect Not Working"
- **Problem**: NEXT_PUBLIC_APP_URL not configured or doesn't match Supabase
- **Solution**:
  1. Set NEXT_PUBLIC_APP_URL in Vercel
  2. Add matching redirect URL in Supabase Dashboard

#### "Cron Job Unauthorized"
- **Problem**: CRON_SECRET not set or doesn't match
- **Solution**: Generate new secret, set in Vercel, redeploy

#### "Processing Timeout"
- **Problem**: PROCESSING_TIMEOUT_MINUTES too high for Vercel limit
- **Solution**: Set to 14 for 15-minute Vercel function limit

---

## Security Best Practices

1. **Never commit secrets**: Use `.env.local` for development, never commit to git
2. **Use strong secrets**: Minimum 32 characters for CRON_SECRET and JWT_SECRET
3. **Rotate secrets regularly**: Update CRON_SECRET and JWT_SECRET periodically
4. **Restrict CORS**: Only add domains you control to CORS_ORIGINS
5. **Monitor usage**: Enable USE_DATABASE_RATE_LIMITING in production
6. **Use HTTPS**: All production URLs must use HTTPS
7. **Separate environments**: Use different secrets for development, staging, and production

---

## Environment-Specific Configurations

### Development
```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
USE_DATABASE_RATE_LIMITING=false
```

### Staging/Preview
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://voice-memory-[branch].vercel.app
CORS_ORIGINS=https://voice-memory-[branch].vercel.app
USE_DATABASE_RATE_LIMITING=true
```

### Production
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://voice-memory-tau.vercel.app
CORS_ORIGINS=https://voice-memory-tau.vercel.app
USE_DATABASE_RATE_LIMITING=true
BATCH_SIZE=5
PROCESSING_TIMEOUT_MINUTES=14
```

---

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
