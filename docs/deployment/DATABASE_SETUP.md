# Database Setup Guide for Voice Memory

## Quick Fix for Upload Error

If you're getting the error `"new row violates row-level security policy"` when uploading files, follow these steps:

### 1. Go to Supabase Dashboard
- Open your project at [app.supabase.com](https://app.supabase.com)
- Navigate to the SQL Editor

### 2. Run the RLS Policies
Copy and paste the entire contents of `lib/database-rls-policies.sql` into the SQL editor and run it.

This will create all necessary Row Level Security policies for:
- Users table
- Notes table  
- Project knowledge table
- API usage tables

### 3. Verify the Policies
After running the SQL, you can verify the policies are applied:

1. Go to Authentication > Policies in your Supabase dashboard
2. You should see policies for each table
3. Each table should show "RLS enabled"

### 4. Storage Bucket Policies
For file uploads to work, you also need to set storage policies:

1. Go to Storage > Policies in Supabase
2. For the `audio-files` bucket, create these policies:

**INSERT Policy** (Upload files):
```sql
(bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1])
```

**SELECT Policy** (View/Download files):
```sql
(bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1])
```

**DELETE Policy** (Delete files):
```sql
(bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1])
```

## Complete Database Setup

If you're setting up the database from scratch:

1. **Create tables**: Run the schema from the Database Schema section in CLAUDE.md
2. **Create quota tables**: Run `lib/database-migrations.sql`
3. **Apply RLS policies**: Run `lib/database-rls-policies.sql`
4. **Set up storage**: Create the `audio-files` bucket and apply the policies above

## Troubleshooting

### "relation does not exist" errors
Make sure you've created all the tables first before applying RLS policies.

### "permission denied" errors
Check that:
1. RLS is enabled on the table
2. The appropriate policy exists
3. You're authenticated (auth.uid() is not null)

### Storage upload failures
Verify:
1. The `audio-files` bucket exists
2. Storage policies are set up correctly
3. The file path includes the user ID as the first folder

## Testing

After setup, test by:
1. Logging in to your app
2. Uploading an audio file
3. Checking that the file appears in Storage under `audio-files/[your-user-id]/`
4. Verifying the note record is created in the database