# 🔐 Quick Auth Token Setup

## Option 1: Get Token from Production Site (Easiest)

1. **Open Voice Memory in your browser**: Check your Vercel deployment URL (usually https://voice-memory-tau.vercel.app)
2. **Make sure you're logged in** (you should see your notes)
3. **Open Developer Tools**: 
   - Chrome/Edge: Press `F12` or `Cmd+Option+I`
   - Safari: Enable Developer menu first, then `Cmd+Option+I`
4. **Go to**: Application → Storage → Local Storage → [your deployment URL]
5. **Find**: Look for a key like `sb-vbjszugsvrqxosbtffqw-auth-token`
6. **Copy**: Click on it and copy the `access_token` value from the JSON

## Option 2: Create the Auth File

Once you have the token, create a file:

```bash
echo "YOUR_TOKEN_HERE" > .voice-memory-auth
```

Replace `YOUR_TOKEN_HERE` with the actual token you copied.

## Option 3: Add to Environment File

Or add it to your `.env.local`:

```bash
echo "VOICE_MEMORY_AUTH_TOKEN=YOUR_TOKEN_HERE" >> .env.local
```

## Test It Works

After setting up the token, run:

```bash
npm run watch-uploads
```

If authentication is successful, you'll see:
- ✅ Authentication verified
- ✅ Ready! Drop audio files into the audio-exports folder...

## Next Steps

1. Keep the terminal with `npm run watch-uploads` running
2. AirDrop your voice memo from iPhone to the `audio-exports` folder
3. Watch it process automatically!