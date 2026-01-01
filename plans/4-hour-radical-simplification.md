# 4-Hour Radical Simplification Checklist

**Goal:** Delete aggressively, fix 2 critical bugs, deploy a working app.

**Philosophy:** Don't rewrite. Don't reorganize. Just delete and fix.

---

## Hour 1: Delete Everything Non-Essential (60 min)

### Monitoring System (DELETE ENTIRE DIRECTORY)
```bash
rm -rf lib/monitoring/
```
- [ ] Deleted `lib/monitoring/` (~10 files, 800+ lines)

### Admin Features (DELETE)
```bash
rm -rf app/admin-dashboard/
rm -rf app/admin-login/
rm -rf app/api/admin/
```
- [ ] Deleted admin dashboard
- [ ] Deleted admin login
- [ ] Deleted admin API routes

### Debug Pages & Routes (DELETE)
```bash
rm -rf app/debug-auth/
rm -rf app/debug-frontend/
rm -rf app/test-auth/
rm -rf app/api/debug-*/
rm -rf app/api/auth-test/
```
- [ ] Deleted all debug pages
- [ ] Deleted all debug API routes

### Debug Components (DELETE)
```bash
rm -f app/components/AuthDebugInfo.tsx
rm -f app/components/SupabaseInspector.tsx
rm -f app/components/CircuitBreakerStatus.tsx
```
- [ ] Deleted debug components

### Scripts Cleanup (KEEP ONLY 5-10)
```bash
# Keep these:
# - scripts/setup-dev.sh
# - scripts/apply-migration.ts
# - scripts/generate-secrets.ts
# - scripts/health-check.ts (maybe)

# Delete the rest:
rm -f scripts/debug-*.ts
rm -f scripts/test-*.ts
rm -f scripts/emergency-*.ts
rm -f scripts/verify-*.ts
rm -f scripts/fix-*.ts
rm -f scripts/diagnose-*.ts
rm -f scripts/demo-*.ts
rm -f scripts/quick-*.ts
rm -f scripts/force-*.ts
rm -f scripts/reset-*.ts
rm -f scripts/trigger-*.ts
rm -f scripts/inspect-*.ts
rm -f scripts/manual-*.ts
rm -f scripts/check-*.ts
rm -f scripts/create-*.ts
rm -f scripts/send-*.ts
rm -f scripts/view-*.ts
```
- [ ] Reduced scripts/ from 133 to ~10 files

### Lazy Components (DELETE - use regular imports)
```bash
rm -f app/components/LazyAnalysisView.tsx
rm -f app/components/LazyImage.tsx
rm -f app/components/LazyTrelloExportModal.tsx
```
- [ ] Deleted Lazy wrappers

### Milestone Check
```bash
# Count remaining files
find app -name "*.tsx" -o -name "*.ts" | wc -l
find lib -name "*.ts" | wc -l
find scripts -name "*.ts" -o -name "*.sh" | wc -l
```

**Expected reduction:** ~60-80 files deleted

---

## Hour 2: Fix Auth Bug (60 min)

### Diagnose the Dual Auth
```bash
# Find all auth-related files
grep -r "useAuth\|AuthProvider\|getUser\|auth-" --include="*.tsx" --include="*.ts" app/ lib/
```

### The Problem
Two auth systems exist:
1. `app/components/AuthProvider.tsx` - Primary
2. `lib/hooks/use-auth.ts` (or similar) - Secondary, causes race conditions

### The Fix

**Option A: Remove the secondary system**
- [ ] Find `lib/hooks/use-auth.ts` or `lib/auth-utils.ts`
- [ ] Search for components importing it
- [ ] Update those components to use `AuthProvider` context instead
- [ ] Delete the secondary file

**Option B: Consolidate to one file**
- [ ] Keep whichever one `TaskSlideoutPanel.tsx` uses
- [ ] Update all other components to use the same one
- [ ] Delete the unused one

### Verify Fix
- [ ] Start dev server: `npm run dev`
- [ ] Login with magic link
- [ ] Navigate to a note with tasks
- [ ] Click complete on a task
- [ ] **SUCCESS** = task marks complete without error
- [ ] **FAIL** = check console for auth errors, iterate

---

## Hour 3: Fix Processing Locks (45 min)

### The Problem
Notes get stuck in "processing" state forever when processing fails mid-stream.

### The Simple Fix

Edit `app/api/process/route.ts`:

```typescript
// Add at the start of POST handler
// Release any locks older than 15 minutes that never completed
const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

await supabase
  .from('voice_notes')
  .update({ processing_started_at: null })
  .lt('processing_started_at', fifteenMinutesAgo)
  .is('processed_at', null)
```

- [ ] Added lock cleanup to process route
- [ ] Tested: Upload new audio file
- [ ] Verified: Processing completes without hanging

### Alternative: Ignore Stale Locks

If the above doesn't work, modify lock check logic:
```typescript
// When checking if note is locked, also check lock age
const isLocked = note.processing_started_at &&
  new Date(note.processing_started_at) > new Date(Date.now() - 15 * 60 * 1000)
```

- [ ] Modified lock check to ignore stale locks

---

## Hour 4: Clean Up & Deploy (45-60 min)

### Merge NoteCard Components
The `app/components/NoteCard/` directory has 7 files for one component.

**Quick fix:** If it works, leave it. Don't merge yet.
**If you have time:** Copy essential code into single `NoteCard.tsx`

- [ ] Decided: Keep split OR merged
- [ ] If merged: Tested NoteCard still renders

### Remove Unused Imports
```bash
# Run linter to find unused imports
npm run lint

# Or use VS Code "Organize Imports" on each file
```
- [ ] Fixed lint errors (or added to .eslintignore if too many)

### Update README

Replace entire README with:
```markdown
# Voice Memory

Upload voice recordings, get AI transcription + analysis.

## Quick Start

1. Clone repo
2. Copy `.env.example` to `.env.local` and fill in:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - OPENAI_API_KEY
3. `npm install`
4. `npm run dev`

## Deploy

Push to GitHub, connect to Vercel, add env vars.

## Core Flow

Upload → Whisper transcription → GPT-4 analysis → Display
```

- [ ] Updated README to be minimal

### Test Core Flows

- [ ] **Upload:** Can upload audio file
- [ ] **Transcribe:** Processing completes
- [ ] **View:** Note appears with transcription
- [ ] **Tasks:** Can complete a task
- [ ] **Search:** Can search notes

### Deploy

```bash
# Commit changes
git add -A
git commit -m "Radical simplification: remove monitoring, admin, debug code"

# Push to trigger Vercel deployment
git push origin main
```

- [ ] Committed changes
- [ ] Pushed to origin
- [ ] Verified Vercel build succeeds
- [ ] Tested production: upload, view, complete task

---

## Post-Cleanup Assessment

After the 4 hours, answer these questions:

1. **Does upload → transcribe → analyze → display work?**
   - Yes → You have a working app
   - No → Note what's broken, fix it

2. **Does task completion work?**
   - Yes → Auth bug is fixed
   - No → Need deeper investigation

3. **Is the code understandable?**
   - Yes → Keep iterating on this codebase
   - No → Consider DHH's "fresh project" approach

4. **How many files remain?**
   - Target: <50 in app/, <20 in lib/, <10 in scripts/
   - If still bloated: Schedule another cleanup session

---

## What NOT To Do Today

- ❌ Don't reorganize files into new structure
- ❌ Don't write new abstractions
- ❌ Don't touch database schema
- ❌ Don't rewrite tests
- ❌ Don't add new features
- ❌ Don't create new files

**Today is for DELETION only.**

---

## If Something Breaks

1. Check git log for what was deleted
2. Restore specific file: `git checkout HEAD~1 -- path/to/file`
3. If catastrophic: `git reset --hard HEAD~1`

You can always get code back. Delete with confidence.

---

## Success Criteria

After 4 hours:
- [ ] Monitoring system: **GONE**
- [ ] Admin features: **GONE**
- [ ] Debug code: **GONE**
- [ ] 100+ scripts: **GONE** (kept ~10)
- [ ] Auth bug: **FIXED**
- [ ] Processing bug: **FIXED**
- [ ] App deploys and works

**If all boxes checked: You're done.** Use the app for a week before planning any more changes.
