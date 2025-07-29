# Voice Memory

Transform voice notes into actionable insights with AI-powered analysis.

## Overview

Voice Memory is a web application that processes voice recordings through sophisticated AI analysis, extracting 7 key insight categories to help users build an actionable knowledge base from their spoken thoughts.

## Features

### 🎭 Core Analysis
- **7-Point Analysis System**: Sentiment, Topics, Tasks, Ideas, Messages, Cross-References, and Outreach
- **AI-Powered Transcription**: OpenAI Whisper for accurate voice-to-text
- **Intelligent Analysis**: GPT-4 extracts actionable insights from transcriptions

### 📊 Smart Organization  
- **Project Knowledge**: Build a growing knowledge base from your insights
- **Cross-References**: Automatic linking between related notes
- **Search & Discovery**: Full-text search across all your notes and analyses

### ⚡ Performance & Scale
- **Batch Processing**: Efficient processing of multiple voice notes
- **Lazy Loading**: Optimized performance with intersection observer
- **Quota Management**: Built-in rate limiting and usage tracking
- **Error Boundaries**: Comprehensive error handling and recovery

### 📱 Mobile-First
- **Progressive Web App (PWA)**: Install on mobile devices
- **Responsive Design**: Works perfectly on all screen sizes
- **Touch Optimized**: Mobile-friendly interactions and gestures
- **Offline Support**: Basic functionality works without internet

## Tech Stack

- **Frontend/Backend**: Next.js 14 with TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI Services**: OpenAI (Whisper + GPT-4)
- **Styling**: Tailwind CSS
- **Hosting**: Vercel

## 📋 Deployment Plans

### Processing Frequency by Vercel Plan

| Plan | Cost | Cron Jobs | Processing Frequency |
|------|------|-----------|---------------------|
| **Hobby** | Free | 2 total | **Daily** (up to 24hr delay) |
| **Pro** | $20/month | 40 total | **Every 5 minutes** |
| **Enterprise** | Custom | 100+ | **Custom frequency** |

**Current Configuration**: Optimized for Hobby plan (daily processing)  
**For Immediate Processing**: Use manual "Process Now" button in the UI  
**For Frequent Processing**: Consider upgrading to Vercel Pro plan

## Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Supabase account
- OpenAI API key

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd voice-memory
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your credentials:
   - Supabase URL and keys
   - OpenAI API key
   - App configuration

4. **Set up Supabase**
   - Create a new Supabase project
   - Run the database migrations (see `supabase/migrations`)
   - Configure storage bucket for audio files
   - Set up Row Level Security policies

5. **Run the development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
voice-memory/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── components/        # React components
│   └── page.tsx          # Main pages
├── lib/                   # Utility functions
│   ├── supabase.ts       # Supabase client
│   ├── openai.ts         # OpenAI integration
│   ├── analysis.ts       # Analysis logic
│   └── types.ts          # TypeScript types
├── public/               # Static assets
└── supabase/            # Database migrations
```

## Development

```bash
# Run development server
pnpm dev

# Run linting
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build
```

## Database Schema

The app uses three main tables:
- `users`: User accounts
- `notes`: Voice notes with transcriptions and analyses
- `project_knowledge`: Aggregated knowledge base per user

See `PLANNING.md` for detailed schema information.

## Quick Start

```bash
# Clone and install
git clone [repository-url]
cd voice-memory
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to start using the app!

## Documentation

- 📖 **[User Guide](USER_GUIDE.md)** - How to use Voice Memory
- 🚀 **[Deployment Guide](DEPLOYMENT.md)** - Deploy to production
- 📱 **[Mobile Testing](MOBILE_TESTING.md)** - Test on mobile devices
- 📋 **[Tasks](TASKS.md)** - Development progress tracking
- 🎯 **[Planning](PLANNING.md)** - Project architecture and design

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run build:analyze # Analyze bundle size
npm run test         # Run tests
npm run lint         # Check code quality
npm run format       # Format code
npm run typecheck    # Check TypeScript
```

## Project Status

✅ **Week 1-3**: Core functionality complete  
✅ **Week 4**: Polish, testing, and deployment ready  
🚀 **Ready for Production**: All major features implemented

### Recent Achievements
- ✅ Comprehensive error handling and recovery
- ✅ Advanced quota management system  
- ✅ Lazy loading and performance optimization
- ✅ Mobile-first responsive design
- ✅ Progressive Web App (PWA) support
- ✅ Complete test suite and documentation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure your code:
- Passes all tests (`npm test`)
- Follows the linting rules (`npm run lint`)
- Includes appropriate documentation
- Is mobile-friendly and accessible

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support & Community

- 📧 **Issues**: Report bugs and request features via GitHub Issues
- 💬 **Discussions**: Join project discussions
- 📚 **Wiki**: Check the project wiki for additional resources
- 🤝 **Contributing**: See contributing guidelines above

---

**Made with ❤️ using Next.js, Supabase, and OpenAI**