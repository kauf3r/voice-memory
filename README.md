# Voice Memory

Transform voice notes into actionable insights with AI-powered analysis.

## Overview

Voice Memory is a web application that processes voice recordings through sophisticated AI analysis, extracting 7 key insight categories to help users build an actionable knowledge base from their spoken thoughts.

## Features

- **7-Point Analysis System**: Sentiment, Topics, Tasks, Ideas, Messages, Cross-References, and Outreach
- **Batch Processing**: Efficient processing of multiple voice notes
- **Project Knowledge**: Build a growing knowledge base from your insights
- **Search & Discovery**: Full-text search across all your notes and analyses

## Tech Stack

- **Frontend/Backend**: Next.js 14 with TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI Services**: OpenAI (Whisper + GPT-4)
- **Styling**: Tailwind CSS
- **Hosting**: Vercel

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

## Deployment

1. Push to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[License information to be added]

## Support

For issues and questions, please check the documentation or open an issue on GitHub.