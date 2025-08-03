#!/bin/bash

# Multi-Computer Git Workflow Script
# Usage: ./scripts/git-workflow.sh [start|save|sync|status|clean]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BRANCH="main"
REMOTE="origin"

# Function to print colored output
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

# Function to check repository health
check_repository_health() {
    print_status "Checking repository health..."
    if ! git fsck --full 2>/dev/null; then
        print_error "Repository corruption detected!"
        print_error "Run repository recovery before continuing."
        exit 1
    fi
}

# Function to check if we're on the correct branch
check_branch() {
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "$BRANCH" ]; then
        print_warning "You're on branch '$current_branch', switching to '$BRANCH'"
        git checkout $BRANCH || {
            print_error "Failed to switch to branch '$BRANCH'"
            exit 1
        }
    fi
}

# Function to stash uncommitted changes
stash_changes() {
    if ! git diff-index --quiet HEAD --; then
        print_status "Stashing uncommitted changes..."
        git stash push -m "Auto-stash: $(date +%Y%m%d-%H%M%S)" --include-untracked
        echo "true"
    else
        echo "false"
    fi
}

# Function to start work (pull latest changes)
start_work() {
    print_header "Starting Work Session"
    
    check_repository_health
    check_branch
    
    # Stash any uncommitted changes
    local stashed=$(stash_changes)
    
    print_status "Fetching latest changes..."
    git fetch $REMOTE
    
    print_status "Pulling latest changes..."
    if ! git pull $REMOTE $BRANCH; then
        print_error "Pull failed! Attempting to resolve..."
        if [ "$stashed" == "true" ]; then
            print_status "Restoring stashed changes..."
            git stash pop
        fi
        exit 1
    fi
    
    # Restore stashed changes if any
    if [ "$stashed" == "true" ]; then
        print_status "Restoring stashed changes..."
        if ! git stash pop; then
            print_warning "Could not restore stashed changes automatically"
            print_warning "Your changes are saved in stash. Run 'git stash list' to see them."
        fi
    fi
    
    print_status "Working directory ready!"
}

# Function to save work (commit and push)
save_work() {
    print_header "Saving Work"
    
    check_repository_health
    check_branch
    
    # Check if there are changes to commit
    if git diff-index --quiet HEAD --; then
        print_status "No changes to commit."
        return 0
    fi
    
    # Show what will be committed
    print_status "Changes to be committed:"
    git status --short
    
    # Get commit message from user
    echo -n "Enter commit message (or press Enter for auto-generated): "
    read commit_message
    
    if [ -z "$commit_message" ]; then
        # Auto-generate commit message based on changes
        changed_files=$(git diff --name-only --cached 2>/dev/null || git diff --name-only)
        file_count=$(echo "$changed_files" | wc -l)
        commit_message="Update $file_count files: $(echo "$changed_files" | head -3 | tr '\n' ', ' | sed 's/, $//')"
    fi
    
    print_status "Adding all changes..."
    git add .
    
    print_status "Committing changes: $commit_message"
    git commit -m "$commit_message"
    
    print_status "Pushing to remote..."
    if ! git push $REMOTE $BRANCH; then
        print_warning "Push failed. Attempting to pull and merge first..."
        git pull $REMOTE $BRANCH
        git push $REMOTE $BRANCH
    fi
    
    print_status "Work saved successfully!"
}

# Function to sync (pull and merge)
sync_work() {
    print_header "Syncing Work"
    
    check_repository_health
    check_branch
    
    # Stash any uncommitted changes
    local stashed=$(stash_changes)
    
    print_status "Fetching latest changes..."
    git fetch $REMOTE
    
    print_status "Checking for conflicts..."
    local_hash=$(git rev-parse HEAD)
    remote_hash=$(git rev-parse $REMOTE/$BRANCH)
    
    if [ "$local_hash" == "$remote_hash" ]; then
        print_status "Already up to date."
    else
        print_status "Pulling and merging changes..."
        if ! git pull $REMOTE $BRANCH; then
            print_error "Merge conflict detected!"
            print_warning "Please resolve conflicts manually, then run:"
            print_warning "  git add ."
            print_warning "  git commit"
            print_warning "  git push"
            
            if [ "$stashed" == "true" ]; then
                print_warning "Don't forget to apply your stashed changes: git stash pop"
            fi
            exit 1
        fi
    fi
    
    # Restore stashed changes if any
    if [ "$stashed" == "true" ]; then
        print_status "Restoring stashed changes..."
        if ! git stash pop; then
            print_warning "Could not restore stashed changes due to conflicts"
            print_warning "Your changes are saved in stash. Resolve conflicts then run: git stash pop"
        fi
    fi
    
    print_status "Sync complete!"
}

# Function to show status
show_status() {
    print_header "Git Status"
    
    check_repository_health
    check_branch
    
    echo "Current branch: $(git branch --show-current)"
    echo "Remote branch: $REMOTE/$BRANCH"
    echo ""
    
    # Show commit difference
    local_ahead=$(git rev-list --count $REMOTE/$BRANCH..HEAD 2>/dev/null || echo "0")
    remote_ahead=$(git rev-list --count HEAD..$REMOTE/$BRANCH 2>/dev/null || echo "0")
    
    if [ "$local_ahead" -gt 0 ]; then
        print_warning "Local is $local_ahead commits ahead of remote"
    fi
    
    if [ "$remote_ahead" -gt 0 ]; then
        print_warning "Remote is $remote_ahead commits ahead of local"
    fi
    
    if [ "$local_ahead" -eq 0 ] && [ "$remote_ahead" -eq 0 ]; then
        print_status "Local and remote are in sync"
    fi
    
    echo ""
    print_status "Working directory status:"
    git status --short
    
    # Check for stashes
    stash_count=$(git stash list | wc -l)
    if [ "$stash_count" -gt 0 ]; then
        echo ""
        print_warning "You have $stash_count stashed changes"
    fi
}

# Function to clean up
clean_work() {
    print_header "Cleaning Up"
    
    check_branch
    
    print_warning "This will remove all uncommitted changes and untracked files!"
    echo -n "Are you sure? (yes/no): "
    read confirmation
    
    if [ "$confirmation" != "yes" ]; then
        print_status "Cleanup cancelled."
        return 0
    fi
    
    print_status "Removing untracked files and directories..."
    git clean -fd
    
    print_status "Resetting any staged changes..."
    git reset --hard HEAD
    
    print_status "Cleanup complete!"
}

# Main script logic
case "${1:-status}" in
    "start")
        start_work
        ;;
    "save")
        save_work
        ;;
    "sync")
        sync_work
        ;;
    "status")
        show_status
        ;;
    "clean")
        clean_work
        ;;
    *)
        echo "Usage: $0 [start|save|sync|status|clean]"
        echo ""
        echo "Commands:"
        echo "  start  - Pull latest changes and prepare for work"
        echo "  save   - Commit and push current changes"
        echo "  sync   - Pull and merge remote changes"
        echo "  status - Show current git status"
        echo "  clean  - Clean up untracked files and reset changes"
        exit 1
        ;;
esac