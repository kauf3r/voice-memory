# Audio Exports Folder

## Purpose
This folder is monitored by the Voice Memory auto-uploader script. Any audio files placed here will be automatically uploaded to Voice Memory for AI analysis.

## Supported File Types
- MP3 (.mp3)
- M4A (.m4a) 
- WAV (.wav)
- AAC (.aac)
- OGG (.ogg)
- WebM (.webm)
- MP4 audio (.mp4)

## How to Use
1. **From iPhone**: Use AirDrop to send voice memos to this folder
2. **From Mac**: Save or drag audio files directly into this folder
3. **Auto-processing**: Files are automatically uploaded and processed when detected

## File Size Limit
- Maximum file size: 25MB
- Files larger than 25MB will be skipped with an error message

## Auto-Processing
- The auto-uploader script watches this folder for new files
- Files are uploaded to Voice Memory API automatically
- Processing status is displayed in the terminal
- Successfully processed files can be optionally moved to a 'processed' subfolder

## Usage Commands
```bash
# Start the auto-uploader (watches this folder)
npm run watch-uploads

# Or run directly with tsx
tsx scripts/auto-uploader.ts
```

## Notes
- Ensure you're authenticated with Voice Memory before running the auto-uploader
- The script requires your Voice Memory API credentials in .env
- Files are processed in the order they're detected
- Check the terminal output for upload and processing status