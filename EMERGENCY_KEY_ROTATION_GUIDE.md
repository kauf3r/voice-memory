# 🚨 Emergency Supabase Key Rotation Guide

**URGENT**: Your service_role key has been leaked. This guide will help you rotate all keys securely.

## ⚠️ Immediate Actions Required

1. **Stop all deployments** if your app is currently running
2. **Rotate keys immediately** using the provided scripts
3. **Update all environments** (local, staging, production)
4. **Verify functionality** before deleting old keys

## 🔧 Quick Start

### Option 1: Automated Script (Recommended)

```bash
# Run the emergency rotation script
node scripts/emergency-key-rotation.js
```

### Option 2: Manual Process

Follow the step-by-step guide below.

## 📋 Step-by-Step Rotation Process

### Step 1: Backup Current Configuration

The automated script will create backups automatically. For manual backup:

```bash
# Backup environment files
cp .env.local .env.local.backup.$(date +%s)
cp .env.example .env.example.backup.$(date +%s)
```

### Step 2: Rotate Keys in Supabase Dashboard

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/vbjszugsvrqxosbtffqw/settings/api

2. **Rotate Service Role Key**:
   - Find the "service_role" key
   - Click "Rotate"
   - Copy the new key immediately
   - **Keep the old key until verification is complete**

3. **Rotate Anon Key** (recommended for security):
   - Find the "anon" key
   - Click "Rotate"
   - Copy the new key immediately

4. **Note the Project URL** (should remain the same)

### Step 3: Update Local Environment

Update your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://vbjszugsvrqxosbtffqw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_new_anon_key_here
SUPABASE_SERVICE_KEY=your_new_service_role_key_here

# Other variables remain the same
OPENAI_API_KEY=your_openai_key
CRON_SECRET=your_cron_secret
```

### Step 4: Update Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your voice-memory project
3. Go to **Settings** → **Environment Variables**
4. Update these variables:
   - `SUPABASE_SERVICE_KEY`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`

### Step 5: Update Other Configuration Files

#### Update `.claude/settings.local.json` (if exists)

```json
{
  "permissions": {
    "allow": [
      "SUPABASE_SERVICE_KEY=\"your_new_service_role_key_here\""
    ]
  }
}
```

#### Update `vercel.json` (if contains keys)

Check if your `vercel.json` contains any Supabase keys and update them.

### Step 6: Verify the Rotation

```bash
# Run the verification script
node scripts/verify-key-rotation.js

# Test local development
npm run dev

# Test build process
npm run build
```

### Step 7: Test Deployed Application

1. Visit your deployed application
2. Test user authentication
3. Test file upload functionality
4. Test note processing
5. Check all API endpoints

### Step 8: Clean Up Old Keys

**Only after confirming everything works:**

1. Go back to Supabase Dashboard
2. Delete the old service_role key
3. Delete the old anon key (if rotated)

## 🔒 Security Best Practices

### Immediate Actions

1. **Audit Git History**: Check if keys were ever committed
   ```bash
   git log --all --full-history -- .env*
   ```

2. **Check Logs**: Review any logs that might contain keys
   ```bash
   grep -r "eyJ" logs/ 2>/dev/null || echo "No JWT tokens found in logs"
   ```

3. **Review Error Reports**: Check for any error reports containing keys

### Ongoing Security

1. **Enable Supabase Audit Logs**:
   - Go to Supabase Dashboard → Settings → Audit Logs
   - Enable comprehensive logging

2. **Set Up Key Rotation Schedule**:
   - Rotate keys every 90 days
   - Use automated reminders

3. **Use Environment-Specific Keys**:
   - Different keys for development/staging/production
   - Never use production keys in development

4. **Implement Key Monitoring**:
   - Monitor for unusual API usage
   - Set up alerts for key usage patterns

## 🚨 Emergency Contacts

If you need immediate assistance:

1. **Supabase Support**: https://supabase.com/support
2. **Vercel Support**: https://vercel.com/support
3. **Project Documentation**: Check `docs/` folder

## 📊 Verification Checklist

- [ ] Keys rotated in Supabase Dashboard
- [ ] Local `.env.local` updated
- [ ] Vercel environment variables updated
- [ ] Application builds successfully
- [ ] Local development works
- [ ] Deployed application works
- [ ] All functionality tested
- [ ] Old keys deleted from Supabase
- [ ] Git history audited for key leaks
- [ ] Audit logs enabled

## 🔄 Recovery Plan

If something goes wrong:

1. **Restore from backups**:
   ```bash
   cp .env.local.backup.* .env.local
   ```

2. **Revert Vercel environment variables** to old values

3. **Contact support** if issues persist

## 📝 Post-Rotation Tasks

1. **Update team members** about the key rotation
2. **Review security practices** with the team
3. **Document the incident** for future reference
4. **Set up monitoring** for future key leaks
5. **Schedule regular security reviews**

## 🎯 Key Rotation Scripts

### Emergency Rotation Script
```bash
node scripts/emergency-key-rotation.js
```

### Verification Script
```bash
node scripts/verify-key-rotation.js
```

### Manual Verification
```bash
# Test Supabase connection
npm run test:supabase

# Test build process
npm run build

# Test local development
npm run dev
```

---

**Remember**: The service_role key has bypass permissions. If it was leaked, treat this as a critical security incident and rotate immediately.
