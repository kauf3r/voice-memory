# iPhone Voice Memo Integration Guide

This guide explains how to seamlessly transfer voice memos from your iPhone to Voice Memory for automatic AI analysis.

## 🎯 Quick Start

1. **Generate authentication token** (one-time setup):
   ```bash
   npm run generate-auth
   ```

2. **Start the auto-uploader**:
   ```bash
   npm run watch-uploads
   ```

3. **Send voice memos from iPhone**:
   - AirDrop to your Mac → Select the `audio-exports` folder
   - Files are automatically uploaded and processed

## 📱 Method 1: AirDrop + Auto-Uploader (Recommended)

### Setup (5 minutes)
1. Run `npm run generate-auth` and follow the prompts to authenticate
2. Start the watcher: `npm run watch-uploads`
3. Keep the terminal window open

### Usage
1. Open Voice Memos app on iPhone
2. Select the memo you want to analyze
3. Tap Share → AirDrop → Select your Mac
4. When prompted, save to the `audio-exports` folder
5. The file is automatically uploaded and processed
6. Check terminal for analysis results

### Benefits
- ✅ No additional apps required
- ✅ Works with existing Voice Memos app
- ✅ Batch processing support
- ✅ Automatic organization (processed files moved to subfolder)

## 📲 Method 2: iPhone Shortcuts (Direct Upload)

### Setup Instructions

1. **Get your authentication token**:
   - Log into Voice Memory at your deployment URL (usually https://voice-memory-tau.vercel.app)
   - Open browser Developer Tools (F12)
   - Go to Application/Storage → Local Storage
   - Find the key containing "auth-token" and copy the value

2. **Create the Shortcut**:
   - Open Shortcuts app on iPhone
   - Tap + to create new shortcut
   - Add these actions:

#### Step 1: Get Audio File
- Add action: "Get File"
- Set to: Voice Memos

#### Step 2: Set Variables
- Add action: "Text"
- Enter: `[YOUR_DEPLOYMENT_URL]/api/upload` (replace with your deployment URL)
- Add action: "Set Variable" 
- Variable name: `uploadURL`

#### Step 3: Add Authentication
- Add action: "Text"
- Enter: `Bearer YOUR_AUTH_TOKEN_HERE` (replace with your token)
- Add action: "Set Variable"
- Variable name: `authToken`

#### Step 4: Upload File
- Add action: "Get Contents of URL"
- URL: `uploadURL` (select variable)
- Method: POST
- Headers: 
  - Key: `Authorization`
  - Value: `authToken` (select variable)
- Request Body: Form
- Form Fields:
  - Key: `file`
  - Value: File from Step 1

#### Step 5: Process Upload Response
- Add action: "Get Dictionary from Input"
- Add action: "Get Dictionary Value"
- Get: Value for `note`
- Add action: "Get Dictionary Value" 
- Get: Value for `id`
- Add action: "Set Variable"
- Variable name: `noteId`

#### Step 6: Trigger Processing
- Add action: "Text"
- Enter: `{"noteId": ""}` (we'll insert the ID)
- Add action: "Replace Text"
- Find: `""`
- Replace: `noteId` (select variable)
- Add action: "Get Contents of URL"
- URL: `[YOUR_DEPLOYMENT_URL]/api/process` (replace with your deployment URL)
- Method: POST
- Headers:
  - Key: `Authorization`
  - Value: `authToken` (select variable)
  - Key: `Content-Type`
  - Value: `application/json`
- Request Body: File
- File: Output from Replace Text

#### Step 7: Show Result
- Add action: "Show Notification"
- Title: "Voice Memory"
- Body: "Voice memo uploaded and processing!"

3. **Save and name your shortcut** (e.g., "Upload to Voice Memory")

### Usage
1. Record voice memo normally
2. Open Shortcuts app
3. Run "Upload to Voice Memory" shortcut
4. Select your voice memo
5. Wait for confirmation notification
6. Check Voice Memory dashboard for results

### Add to Home Screen (Optional)
1. In Shortcuts app, tap the shortcut
2. Tap settings icon
3. Tap "Add to Home Screen"
4. Now you can upload with one tap from home screen

## 🔧 Troubleshooting

### Auto-Uploader Issues

**"No authentication token found"**
- Run `npm run generate-auth` to create a token
- Or add `VOICE_MEMORY_AUTH_TOKEN=your_token` to `.env` file

**"Authentication token is invalid or expired"**
- Generate a new token: `npm run generate-auth`
- Tokens expire after extended periods

**Files not being detected**
- Ensure files are saved directly to `audio-exports` folder
- Check that file extension is supported (.mp3, .m4a, .wav, etc.)
- Verify auto-uploader is running (`npm run watch-uploads`)

**"File too large" error**
- Maximum file size is 25MB
- Compress or trim longer recordings

### iPhone Shortcuts Issues

**"The operation couldn't be completed"**
- Check your authentication token is correct
- Ensure you're connected to internet
- Verify the API URL is correct

**Shortcut fails at upload step**
- Make sure the voice memo is selected properly
- Check that Headers are set correctly
- Verify Form field key is exactly "file"

## 📁 File Organization

The auto-uploader organizes files automatically:

```
audio-exports/
├── README.md           # Instructions
├── your-memo.m4a      # New files go here
└── processed/         # Successfully processed files
    └── your-memo.m4a  # Moved here after processing
```

## 🛡️ Security Notes

- **Auth tokens are sensitive** - never share or commit them to git
- The `.voice-memory-auth` file is automatically ignored by git
- Tokens are tied to your user account
- Generate new tokens periodically for security

## 🚀 Advanced Usage

### Batch Processing
Drop multiple audio files into the folder at once - they'll be processed sequentially.

### Custom Scripts
You can also use the API directly in your own scripts:

```bash
# Upload a file
curl -X POST [YOUR_DEPLOYMENT_URL]/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@your-audio.mp3"

# Process a note
curl -X POST [YOUR_DEPLOYMENT_URL]/api/process \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"noteId": "NOTE_ID_HERE"}'
```

### Automation Ideas
- Set up Hazel or Automator to watch Downloads folder
- Create email-to-upload integration
- Build iOS widget for quick access
- Integrate with other voice recording apps

## 📞 Support

If you encounter issues:
1. Check the terminal output for detailed error messages
2. Verify your authentication is working
3. Ensure audio files are in supported formats
4. Check file permissions on the audio-exports folder

For more help, see the main project documentation or file an issue on GitHub.