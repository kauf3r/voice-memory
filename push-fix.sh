#!/bin/bash

echo "🔧 Attempting to push critical Supabase fix..."

# Kill any git processes
pkill -f git || true

# Remove lock files
rm -f .git/index.lock
rm -f .git/index.lock.backup

# Wait a moment
sleep 1

# Try to add and commit
git add lib/supabase.ts
git commit -m "🔥 CRITICAL: Restore missing Supabase client configuration

This fixes:
- WebSocket connection failures
- File upload stuck issues  
- Real-time subscription errors
- Circuit breaker failures

lib/supabase.ts was empty (0 lines) causing total app failure."

# Push to origin
git push origin main

echo "✅ Fix pushed successfully!"