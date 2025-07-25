#!/bin/bash
# Load environment variables and run migration fix

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "Error: .env.local file not found"
    exit 1
fi

# Export environment variables from .env.local
export $(grep -v '^#' .env.local | xargs)

# Run the migration fix script
npx tsx scripts/immediate-migration-fix.ts