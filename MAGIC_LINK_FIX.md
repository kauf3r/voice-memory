# Magic Link Authentication Fix

## Current Status
✅ Dev server running at http://localhost:3000
✅ Debug tool available at http://localhost:3000/debug-magic-link
✅ Missing dependency `isows` installed
✅ Webpack configuration updated to handle Supabase realtime

## The Problem
When you click a magic link from your email, it redirects back to the login page instead of signing you in.

**Root Cause:** The PKCE (Proof Key for Code Exchange) flow requires that you click the magic link **in the same browser** where you requested it. The code verifier is stored in localStorage when you request the link, and needs to be available when you click it.

**Common scenarios that cause this:**
- Requesting magic link in Chrome, but clicking it opens in your default email client's browser
- Requesting on desktop, clicking on mobile (different device/browser)
- Browser cleared localStorage/cache between requesting and clicking
- Using incognito/private mode and opening link in regular browser

This is a security feature to prevent man-in-the-middle attacks.

## Solution Steps

### Step 1: Configure Supabase Redirect URLs (CRITICAL)

1. Open your Supabase dashboard: https://supabase.com/dashboard/project/vbjszugsvrqxosbtffqw

2. Navigate to: **Authentication** → **URL Configuration**

3. Add these URLs to the **Redirect URLs** allowlist:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000
   ```

4. If you have a production URL, also add:
   ```
   https://your-domain.com/auth/callback
   https://your-domain.com
   ```

5. Click **Save** and wait 1-2 minutes for the changes to propagate

### Step 2: Test with Debug Tool

1. Open http://localhost:3000/debug-magic-link in your browser

2. Enter your email address and click "Send Magic Link"

3. The debug logs will show:
   - Whether the magic link was sent successfully
   - What redirect URL is being used
   - Any errors from Supabase

4. Check your email (including spam/junk folder)

5. Click the magic link in your email

6. The debug tool will show detailed logs of what happens during authentication

### Step 3: Verify the Flow

After configuring Supabase, the magic link flow should work like this:

1. User enters email → sends magic link
2. User clicks link in email → redirects to `/auth/callback?code=...`
3. Callback route exchanges code for session → redirects to home page
4. User is now authenticated and sees their notes

## Common Issues

### Issue: "Redirect URL not configured"
**Solution:** Make sure you added the exact URLs (including `/auth/callback` path) to Supabase

### Issue: "Link expired"
**Solution:** Magic links expire after 1 hour. Request a new one.

### Issue: "Link already used"
**Solution:** Each magic link can only be used once. Request a new one.

### Issue: "Still redirecting to login" or "code verifier" error
**Solution:**
1. **Same Browser Required:** You MUST click the magic link in the SAME browser where you requested it
2. **Quick test workflow:**
   - Open http://localhost:3000 in Chrome (or your preferred browser)
   - Enter your email and send magic link
   - Open your email **in a new tab** in the same Chrome window
   - Click the magic link - it should work!
3. If email opens in a different browser:
   - Copy the magic link URL
   - Paste it into the same browser where you sent the request
4. Alternative: Don't use magic links during development - use the admin login if available

## Debug Tool Features

The debug tool at `/debug-magic-link` provides:

- Real-time authentication state logging
- URL parameter inspection
- Session status checking
- Test callback URL functionality
- Step-by-step configuration instructions

## Technical Details

### Auth Flow Architecture

```
1. LoginForm.tsx
   ↓ signInWithEmail(email)

2. AuthProvider.tsx
   ↓ supabase.auth.signInWithOtp({
       emailRedirectTo: 'http://localhost:3000/auth/callback'
     })

3. User's Email
   ↓ Click magic link

4. /auth/callback/route.ts
   ↓ supabase.auth.exchangeCodeForSession(code)
   ↓ Set session cookies
   ↓ Redirect to home page

5. AuthProvider.tsx
   ↓ onAuthStateChange detects SIGNED_IN event
   ↓ Updates user state

6. User sees authenticated home page
```

### Files Modified

- `next.config.js` - Added webpack config for isows module
- `app/debug-magic-link/page.tsx` - New debug tool (can be deleted after fixing)
- `package.json` - Added isows dependency

## Next Steps

1. Configure Supabase redirect URLs (most important!)
2. Use the debug tool to test the flow
3. Share the debug logs if you still have issues

## Cleanup (After Fix)

Once magic links are working, you can optionally delete:
- `app/debug-magic-link/page.tsx` (the debug tool)
- This file (`MAGIC_LINK_FIX.md`)

The webpack configuration in `next.config.js` should stay to prevent the isows module error.
