#!/bin/bash
# Voice Memory Git Repository Health Monitoring and Maintenance Script
# Usage: ./git-maintenance.sh [check|clean|optimize|full]

set -e

REPO_PATH="$(pwd)"
LOG_FILE="$REPO_PATH/git-maintenance.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_repo_health() {
    log "=== Repository Health Check ==="
    
    # Check repository size
    repo_size=$(du -sh .git/ | cut -f1)
    log "Repository size: $repo_size"
    
    # Check number of objects
    objects_count=$(find .git/objects -type f | wc -l)
    log "Git objects count: $objects_count"
    
    # Check for corrupted objects
    log "Checking for corrupted objects..."
    if git fsck --no-progress --no-dangling 2>/dev/null; then
        log "✅ No corrupted objects found"
    else
        log "❌ Found corrupted objects - run git fsck for details"
    fi
    
    # Check worktrees
    log "Active worktrees:"
    git worktree list 2>/dev/null || log "No worktrees configured"
    
    # Check large files
    log "Checking for large files (>50MB)..."
    find . -type f -size +50M -not -path "./.git/*" -not -path "./node_modules/*" | head -5 || log "No large files found"
}

clean_repo() {
    log "=== Repository Cleanup ==="
    
    # Remove stale lock files
    log "Removing stale lock files..."
    find .git -name "*.lock" -delete 2>/dev/null || true
    
    # Clean up loose objects
    log "Cleaning up loose objects..."
    git gc --prune=now --aggressive
    
    # Cleanup reflog
    log "Cleaning reflog..."
    git reflog expire --expire=30.days --all
    
    # Prune worktrees
    log "Pruning deleted worktrees..."
    git worktree prune 2>/dev/null || true
    
    log "✅ Repository cleanup completed"
}

optimize_repo() {
    log "=== Repository Optimization ==="
    
    # Repack objects for better performance
    log "Repacking objects..."
    git repack -ad --depth=250 --window=250
    
    # Update server info (useful for dumb HTTP transport)
    log "Updating server info..."
    git update-server-info
    
    # Pack refs for better performance
    log "Packing refs..."
    git pack-refs --all --prune
    
    log "✅ Repository optimization completed"
}

check_disk_space() {
    log "=== Disk Space Check ==="
    available_space=$(df -h . | awk 'NR==2 {print $4}')
    log "Available disk space: $available_space"
}

# Main execution
case "${1:-check}" in
    "check")
        check_repo_health
        check_disk_space
        ;;
    "clean")
        clean_repo
        ;;
    "optimize")
        optimize_repo
        ;;
    "full")
        check_repo_health
        clean_repo
        optimize_repo
        check_disk_space
        log "=== Full maintenance completed ==="
        ;;
    *)
        echo "Usage: $0 [check|clean|optimize|full]"
        echo "  check    - Check repository health (default)"
        echo "  clean    - Clean up repository"
        echo "  optimize - Optimize repository performance"
        echo "  full     - Run all maintenance tasks"
        exit 1
        ;;
esac

log "Maintenance task '$1' completed successfully"