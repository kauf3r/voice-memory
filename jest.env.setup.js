// Environment setup for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.OPENAI_WHISPER_MODEL = 'whisper-1'
process.env.OPENAI_GPT_MODEL = 'gpt-4-turbo-preview'
process.env.VERCEL = 'test'
process.env.VERCEL_URL = 'test.vercel.app'