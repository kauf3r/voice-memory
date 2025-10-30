# Multi-Computer Development Workflow

This document outlines the workflow for developing the Voice Memory project across multiple computers while maintaining code consistency and avoiding conflicts.

## Quick Start

### First Time Setup (on each computer)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kauf3r/voice-memory.git
   cd voice-memory
   ```

2. **Run the setup script:**
   ```bash
   npm run setup
   # or
   ./scripts/setup-dev.sh
   ```

3. **Configure your environment:**
   - Edit `.env` with your API keys and configuration
   - Check `.env.local.[computer-name]` for machine-specific settings

### Daily Workflow

#### Starting Work
```bash
npm run git:start
```
This will:
- Check repository health
- Switch to main branch
- Stash any uncommitted changes
- Pull latest changes from remote
- Restore your stashed changes

#### Saving Work
```bash
npm run git:save
```
This will:
- Check repository health
- Show changes to be committed
- Prompt for commit message
- Add all changes
- Commit and push to remote

#### Syncing Changes
```bash
npm run git:sync
```
This will:
- Stash uncommitted changes
- Pull and merge remote changes
- Handle conflicts if any
- Restore stashed changes

#### Checking Status
```bash
npm run git:status
```
Shows:
- Current branch
- Commits ahead/behind remote
- Uncommitted changes
- Stashed changes

## Best Practices

### 1. Always Start with Sync
Before beginning work on any computer:
```bash
npm run git:start
```

### 2. Save Work Frequently
Before switching computers or taking breaks:
```bash
npm run git:save
```

### 3. Handle Conflicts Gracefully
If you encounter merge conflicts:
1. The workflow script will notify you
2. Resolve conflicts in your editor
3. Run:
   ```bash
   git add .
   git commit
   git push
   ```
4. Apply any stashed changes: `git stash pop`

### 4. Use Descriptive Commits
When saving work, provide meaningful messages:
- "Add user authentication feature"
- "Fix processing pipeline timeout issue"
- "Update documentation for API endpoints"

### 5. Environment Management
- Keep `.env` files local to each machine
- Use `.env.local.[computer-name]` for machine-specific configs
- Never commit sensitive information

## Repository Health

The workflow automatically checks repository health before operations. If corruption is detected:

1. **Don't panic** - Your work is likely recoverable
2. **Run the backup script** (if available)
3. **Follow recovery procedures** in this document

## Troubleshooting

### Git Repository Corruption
If you see "Repository corruption detected!":
1. Back up your work: `cp -r . ../backup-$(date +%Y%m%d)`
2. Try: `git fsck --full`
3. If severe, follow the recovery procedure below

### Merge Conflicts
The workflow handles most conflicts automatically, but if manual intervention is needed:
1. Edit conflicted files (look for `<<<<<<<` markers)
2. Remove conflict markers after choosing changes
3. Add and commit: `git add . && git commit`

### Stash Issues
If stashed changes won't apply:
1. View stashes: `git stash list`
2. Try applying manually: `git stash apply stash@{0}`
3. If conflicts, resolve them and `git stash drop`

## Emergency Recovery

### Full Repository Recovery
If the repository is severely corrupted:

```bash
# 1. Backup everything
cp -r . ../voice-memory-backup-$(date +%Y%m%d)

# 2. Save uncommitted changes
git stash push -m "Emergency backup" || true
git stash show -p > ../emergency-changes.patch || true

# 3. Re-clone repository
cd ..
mv voice-memory voice-memory-corrupted
git clone https://github.com/kauf3r/voice-memory.git
cd voice-memory

# 4. Restore your work
cp ../voice-memory-corrupted/.env .
# Apply other local changes as needed
```

### Quick Fixes

**Reset to remote state:**
```bash
git fetch origin
git reset --hard origin/main
```

**Clean working directory:**
```bash
npm run git:clean
```

**Check what changed:**
```bash
git log --oneline -10
git diff origin/main
```

## Platform-Specific Notes

### macOS
- Git hooks are automatically executable
- Use `brew` to install dependencies

### Windows
- Use Git Bash for scripts
- May need to run `chmod +x` on scripts
- Line ending issues: configure git with `core.autocrlf=true`

### Linux
- Scripts should work without modification
- Ensure Node.js 18+ is installed

## Security Considerations

1. **Never commit:**
   - API keys
   - `.env` files
   - Authentication tokens
   - Personal information

2. **Use `.gitignore`** for:
   - Environment files
   - Build artifacts
   - IDE configurations
   - Temporary files

3. **Rotate credentials** if accidentally exposed

## Automation Features

### Pre-commit Hooks
Automatically runs:
- Repository health check
- Linting (if configured)
- Type checking (if configured)

### Post-merge Hooks
Automatically:
- Updates dependencies if package-lock.json changed
- Notifies of configuration changes

## Tips for Productivity

1. **Use aliases** for common commands:
   ```bash
   alias vstart='npm run git:start'
   alias vsave='npm run git:save'
   alias vsync='npm run git:sync'
   ```

2. **Set up notifications** for build status

3. **Use VS Code's git integration** alongside scripts

4. **Keep commits atomic** - one feature/fix per commit

5. **Review changes** before committing: `git diff`

## Support

If you encounter issues not covered here:
1. Check the project's issue tracker
2. Review git logs: `git log --oneline -20`
3. Ask for help with full error messages
4. Always backup before trying fixes