# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - Project name: `voice-memory`
   - Database password: (save this securely)
   - Region: Choose closest to your users
5. Click "Create new project"

## 2. Get Your API Keys

After project creation:
1. Go to Settings → API
2. Copy these values to your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The `anon` public key
   - `SUPABASE_SERVICE_KEY`: The `service_role` key (keep secret!)

## 3. Run Database Migrations

1. Go to SQL Editor in Supabase dashboard
2. Run each migration file in order:
   - `20240118_initial_schema.sql`
   - `20240118_row_level_security.sql`

## 4. Set Up Authentication

1. Go to Authentication → Providers
2. Enable Email provider
3. Configure:
   - Enable email confirmations: OFF (for easier development)
   - Minimum password length: 8
4. Go to Authentication → Email Templates
5. Customize the magic link email template

## 5. Create Storage Bucket

1. Go to Storage
2. Click "Create bucket"
3. Name: `audio-files`
4. Public: OFF (keep files private)
5. File size limit: 50MB
6. Allowed MIME types: `audio/*`

## 6. Set Storage Policies

In Storage → Policies for `audio-files` bucket:

**INSERT Policy** - "Users can upload to own folder"
```sql
(bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1])
```

**SELECT Policy** - "Users can view own files"
```sql
(bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1])
```

**DELETE Policy** - "Users can delete own files"
```sql
(bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1])
```

## 7. Test Your Setup

Run the test file:
```bash
npm run test:supabase
```

## Common Issues

### RLS Policies Not Working
- Make sure you're authenticated when making requests
- Check that policies are enabled on tables
- Verify the user ID matches the row owner

### Storage Upload Fails
- Check file size limits
- Verify MIME type is audio/*
- Ensure folder structure is: `{user_id}/{filename}`

### Authentication Issues
- Check that email provider is enabled
- Verify your API keys are correct
- Make sure you're using the anon key on client side

## Production Checklist

Before going to production:
- [ ] Enable email confirmations
- [ ] Set up custom email domain
- [ ] Configure rate limiting
- [ ] Set up database backups
- [ ] Monitor usage quotas
- [ ] Enable 2FA for team members