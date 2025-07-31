#!/bin/bash

# Development Environment Setup Script
# Run this on each computer you work on

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_header "Voice Memory Development Environment Setup"

# Check prerequisites
print_status "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js not found. Please install Node.js 18+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi
node_version=$(node --version)
print_status "Node.js version: $node_version"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm not found. Please install npm first."
    exit 1
fi
npm_version=$(npm --version)
print_status "npm version: $npm_version"

# Check git
if ! command -v git &> /dev/null; then
    print_error "git not found. Please install git first."
    exit 1
fi
git_version=$(git --version)
print_status "Git version: $git_version"

# Install dependencies
print_header "Installing Dependencies"
print_status "Running npm install..."
if ! npm install; then
    print_error "Failed to install dependencies"
    exit 1
fi

# Setup environment files
print_header "Setting Up Environment"

# Check if .env exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_status "Creating .env file from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env file with your configuration values:"
        echo ""
        cat .env.example | grep -E "^[A-Z]" | cut -d'=' -f1 | while read var; do
            echo "  - $var"
        done
        echo ""
    else
        print_error "No .env.example found. Please create a .env file manually."
    fi
else
    print_status ".env file already exists"
fi

# Create local environment file for this computer
computer_name=$(hostname | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
local_env_file=".env.local.$computer_name"
if [ ! -f "$local_env_file" ]; then
    print_status "Creating computer-specific environment file: $local_env_file"
    echo "# Computer-specific environment variables for $computer_name" > "$local_env_file"
    echo "# Add any machine-specific configurations here" >> "$local_env_file"
    echo "" >> "$local_env_file"
fi

# Setup git configuration
print_header "Git Configuration"

# Check git user configuration
git_user=$(git config user.name || echo "")
git_email=$(git config user.email || echo "")

if [ -z "$git_user" ] || [ -z "$git_email" ]; then
    print_warning "Git user configuration not set."
    echo ""
    echo "Please configure git with your information:"
    echo "  git config --global user.name \"Your Name\""
    echo "  git config --global user.email \"your.email@example.com\""
    echo ""
fi

# Set up git hooks directory
print_status "Setting up git hooks..."
mkdir -p .git/hooks

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Pre-commit hook for voice-memory project

echo "Running pre-commit checks..."

# Check repository health
if ! git fsck --full >/dev/null 2>&1; then
    echo "⚠️  Warning: Repository health check failed"
    echo "Consider running git fsck --full to investigate"
fi

# Check branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    echo "⚠️  Warning: Committing to branch '$current_branch' instead of 'main'"
fi

# Run linting if available
if [ -f "package.json" ] && grep -q "\"lint\"" package.json; then
    echo "Running linter..."
    if npm run lint >/dev/null 2>&1; then
        echo "✓ Linting passed"
    else
        echo "⚠️  Linting issues found. Run 'npm run lint' to see details."
    fi
fi

# Run type checking if available
if [ -f "package.json" ] && grep -q "\"typecheck\"" package.json; then
    echo "Running type check..."
    if npm run typecheck >/dev/null 2>&1; then
        echo "✓ Type checking passed"
    else
        echo "⚠️  Type errors found. Run 'npm run typecheck' to see details."
    fi
fi

echo "Pre-commit checks completed!"
EOF

chmod +x .git/hooks/pre-commit

# Create post-merge hook for dependency updates
cat > .git/hooks/post-merge << 'EOF'
#!/bin/bash

# Check if package-lock.json changed
if git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD | grep -q "package-lock.json"; then
    echo "📦 package-lock.json changed. Running npm install..."
    npm install
fi
EOF

chmod +x .git/hooks/post-merge

# Verify database setup
print_header "Database Configuration"

if [ -f ".env" ]; then
    if grep -q "SUPABASE_URL" .env && grep -q "SUPABASE_ANON_KEY" .env; then
        print_status "Supabase configuration found in .env"
    else
        print_warning "Supabase configuration missing in .env"
        echo "Please add:"
        echo "  - SUPABASE_URL"
        echo "  - SUPABASE_ANON_KEY"
    fi
    
    if grep -q "OPENAI_API_KEY" .env; then
        print_status "OpenAI configuration found in .env"
    else
        print_warning "OpenAI API key missing in .env"
        echo "Please add: OPENAI_API_KEY"
    fi
fi

# Create convenience scripts
print_header "Creating Convenience Scripts"

# Add git workflow aliases to package.json if not already present
if ! grep -q "git:start" package.json; then
    print_status "Adding git workflow commands to package.json..."
    # Note: In a real implementation, this would properly modify package.json
    print_warning "Please manually add these scripts to package.json:"
    echo '  "git:start": "./scripts/git-workflow.sh start",'
    echo '  "git:save": "./scripts/git-workflow.sh save",'
    echo '  "git:sync": "./scripts/git-workflow.sh sync",'
    echo '  "git:status": "./scripts/git-workflow.sh status",'
fi

# Final setup
print_header "Setup Complete!"

print_status "Your development environment is ready!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration values"
echo "2. Start the development server: npm run dev"
echo ""
echo "Git workflow commands:"
echo "  npm run git:start  - Start work (pull latest changes)"
echo "  npm run git:save   - Save work (commit and push)"
echo "  npm run git:sync   - Sync with remote"
echo "  npm run git:status - Check git status"
echo ""
echo "Or use the scripts directly:"
echo "  ./scripts/git-workflow.sh [start|save|sync|status|clean]"
echo ""

# Check if we should run the dev server
echo -n "Would you like to start the development server now? (y/n): "
read start_dev

if [ "$start_dev" = "y" ] || [ "$start_dev" = "Y" ]; then
    print_status "Starting development server..."
    npm run dev
fi