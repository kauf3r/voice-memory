# feat: Voice Memory Codebase Improvement (Refined Plan)

> Generated: January 2026 (Agent-Refined)
> Status: Ready for Review
> Tracking: 16 open beads + 28 critical gaps identified

---

## Executive Summary

This refined plan incorporates findings from **three research agents** and **SpecFlow analysis** that identified **28 critical gaps**, **17 missing edge cases**, and **12 silent failure scenarios** in the original plan.

### Critical Finding: Phase Ordering Violation

The original plan has a **dependency violation**:
- Phase 1.3 (Auth Consolidation) was scheduled BEFORE Phase 1.4 (Data Integrity)
- This will cause migration failures because FK constraints require clean data first

### Key Changes from Original Plan

| Original | Refined |
|----------|---------|
| 4 Phases | 5 Phases (added Phase 0) |
| Week 1: 1.1, 1.2, 1.4 | Week 0: Phase 0 (Pre-flight) |
| No rollback scripts | Rollback scripts for every migration |
| DELETE debug endpoints | Guard + audit log (for production debugging) |
| Fix RealtimeManager only | Fix RealtimeManager + PollingManager + subscription versioning |

---

## Tracked Issues (16 Open Beads)

### P0 Critical (5 issues)
| Bead | Issue | Status |
|------|-------|--------|
| voice-memory-9yw | 22+ SELECT * queries (40-60% wasted data) | Phase 3.5 |
| voice-memory-zp9 | FK migration will fail (orphans) | **Phase 0.1** |
| voice-memory-7x6 | 3 NoteAnalysis definitions (silent failures) | **Phase 0.2** |
| voice-memory-d1v | Shortcut upload bypasses security | Phase 1.2 |
| voice-memory-des | Debug endpoint NO production guard | Phase 1.2 |

### P1 High (6 issues)
| Bead | Issue | Status |
|------|-------|--------|
| voice-memory-u5g | Pin order race condition | Phase 3.4 |
| voice-memory-bnk | PollingManager wrong table | Phase 1.4 |
| voice-memory-wdy | Tasks API N+1 pattern | Phase 3.5 |
| voice-memory-17j | reorder_pinned_tasks SECURITY DEFINER | Phase 3.4 |
| voice-memory-wsx | Admin email privilege escalation | Phase 1.3 |
| voice-memory-y6h | Refresh token misuse (12+ routes) | Phase 1.3 |

### P2 Medium (5 issues)
| Bead | Issue | Status |
|------|-------|--------|
| voice-memory-ogp | No cache invalidation | Phase 3.5 |
| voice-memory-2na | getOrCreateTaskState race condition | Phase 3.4 |
| voice-memory-atq | Polling no backoff (12 req/min) | Phase 3.5 |
| voice-memory-bv6 | Phase ordering wrong | **FIXED in this plan** |
| voice-memory-w7z | VirtualizedNoteList disabled | Phase 3.5 |

---

## Phase 0: Pre-flight Validation (NEW - 4-6 hours)

> **MUST COMPLETE BEFORE ANY OTHER PHASE**
> Failure to complete Phase 0 will cause database corruption.

### 0.1 Data Integrity Audit

**Files:** `supabase/migrations/20260101_pre_fk_cleanup.sql`

```sql
-- Step 1: Count orphaned records (DO NOT SKIP)
SELECT
  'task_states' as table_name,
  COUNT(*) as orphaned_count
FROM task_states ts
LEFT JOIN notes n ON ts.note_id = n.id
WHERE n.id IS NULL

UNION ALL

SELECT
  'task_completions' as table_name,
  COUNT(*) as orphaned_count
FROM task_completions tc
LEFT JOIN notes n ON tc.note_id = n.id
WHERE n.id IS NULL;

-- Step 2: Archive orphans (preserves audit trail)
CREATE TABLE IF NOT EXISTS _archived_orphaned_task_states (
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  original_data JSONB
);

INSERT INTO _archived_orphaned_task_states (original_data)
SELECT to_jsonb(ts.*) FROM task_states ts
LEFT JOIN notes n ON ts.note_id = n.id
WHERE n.id IS NULL;

-- Step 3: Delete orphans
DELETE FROM task_states
WHERE note_id NOT IN (SELECT id FROM notes);

-- Step 4: Create rollback script
-- File: supabase/rollbacks/20260101_pre_fk_cleanup.rollback.sql
-- INSERT INTO task_states SELECT * FROM _archived_orphaned_task_states;
```

**Acceptance Criteria:**
- [ ] Zero orphaned task_states after cleanup
- [ ] Archive table contains deleted records for audit
- [ ] Rollback script tested in staging

**Closes:** voice-memory-zp9

---

### 0.2 Type System Alignment

**Files:** `lib/types.ts`, `lib/analysis.ts`, `lib/validation.ts`

**Problem:** Three competing NoteAnalysis definitions cause 100% of analyses to fail silently.

**Decision Required:**
- [ ] Use simplified schema (6 fields) - faster, less data
- [ ] Use full BIB framework (15 fields) - richer analysis
- [ ] Hybrid with optional extended fields

**Implementation (assuming simplified):**

```typescript
// lib/types/note-analysis.ts (NEW - source of truth)
export interface NoteAnalysis {
  summary: string
  mood: 'positive' | 'neutral' | 'negative'
  topic: string
  theOneThing: string | null
  tasks: AnalysisTask[]
  draftMessages: DraftMessage[]
  people: MentionedPerson[]
  recordedAt: string
}

// lib/validation.ts - UPDATE to match
export const AnalysisSchema = z.object({
  summary: z.string(),
  mood: z.enum(['positive', 'neutral', 'negative']),
  topic: z.string(),
  theOneThing: z.string().nullable(),
  tasks: z.array(AnalysisTaskSchema),
  draftMessages: z.array(DraftMessageSchema),
  people: z.array(MentionedPersonSchema),
  recordedAt: z.string()
})

// lib/analysis.ts - UPDATE prompt to return exactly these fields
```

**Acceptance Criteria:**
- [ ] Single NoteAnalysis definition exported from `lib/types/note-analysis.ts`
- [ ] Validation schema matches type definition exactly
- [ ] Prompt output matches validation schema
- [ ] All existing tests pass

**Closes:** voice-memory-7x6

---

### 0.3 Subscription Version Tracking

**Files:** `app/services/RealtimeManager.ts`, `lib/constants.ts`

**Problem:** Changing subscription table from `task_pins` to `task_states` will break existing connections.

```typescript
// lib/constants.ts (NEW)
export const SUBSCRIPTION_VERSION = 2 // Increment on breaking changes

// app/services/RealtimeManager.ts
private setupSubscription() {
  const storedVersion = localStorage.getItem('subscription_version')

  if (storedVersion !== SUBSCRIPTION_VERSION.toString()) {
    // Force resubscribe on breaking changes
    await this.subscription?.unsubscribe()
    localStorage.setItem('subscription_version', SUBSCRIPTION_VERSION.toString())
  }

  this.subscription = supabase
    .channel(`task_states_changes_${this.userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'task_states', // ✅ Correct table
      filter: `user_id=eq.${this.userId}`
    }, this.handleChange)
    .subscribe()
}
```

**Acceptance Criteria:**
- [ ] Subscription version tracked in localStorage
- [ ] Old clients auto-resubscribe on next page load
- [ ] No mixed state between old/new subscriptions

---

## Phase 1: Critical Security & Stability (Week 1)

### 1.1 TypeScript Configuration Fixes

**Files:** `tsconfig.json:11`, `next.config.js:172-174`

**Effort:** 4 hours (incremental strict mode adoption)

**Implementation:**

```json
// tsconfig.json - Enable incrementally
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

```bash
# Validation
npx tsc --noEmit 2>&1 | head -50
npm run build
```

**Acceptance Criteria:**
- [ ] `npm run build` succeeds with strict mode
- [ ] No TypeScript errors in production build
- [ ] ESLint rule added to prevent `any` regression

---

### 1.2 Security Hardening

**Files:** `app/api/debug-*/route.ts`, `middleware.ts`, `app/api/shortcut-upload/route.ts`

**Effort:** 4-5 hours

#### 1.2.1 Guard Debug Endpoints (NOT delete)

**Rationale:** Deleting debug endpoints removes production debugging capability. Instead, add production guard with audit logging.

```typescript
// app/api/debug-client-env/route.ts
export async function GET(request: NextRequest) {
  // Production guard with audit logging
  if (process.env.NODE_ENV === 'production') {
    console.error('⚠️ Debug endpoint access attempt', {
      ip: request.headers.get('x-forwarded-for'),
      ua: request.headers.get('user-agent'),
      timestamp: new Date().toISOString()
    })
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  // Development only
  return NextResponse.json({...})
}
```

**Closes:** voice-memory-des

#### 1.2.2 Secure Shortcut Upload

```typescript
// app/api/shortcut-upload/route.ts
import { checkRateLimit } from '@/lib/middleware/rate-limit'
import { validateAudioFile } from '@/lib/security/file-validation'
import { checkUserQuota } from '@/lib/quota-manager'

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')

  // 1. Rate limiting (MISSING - add now)
  const { allowed } = await checkRateLimit(apiKey, {
    maxRequests: 10,
    windowMs: 60000
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // 2. File validation (MISSING - add now)
  const file = await request.formData().then(f => f.get('audio'))
  const validation = await validateAudioFile(file)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // 3. Quota check (MISSING - add now)
  const quota = await checkUserQuota(userId)
  if (quota.exceeded) {
    return NextResponse.json({ error: 'Quota exceeded' }, { status: 403 })
  }

  // ... existing logic
}
```

**Closes:** voice-memory-d1v

#### 1.2.3 Add CSRF Protection

```typescript
// middleware.ts
import { createCsrfProtect } from '@edge-csrf/nextjs'

const csrfProtect = createCsrfProtect({
  cookie: { secure: true, sameSite: 'strict' },
  excludePathPrefixes: ['/api/shortcut-upload', '/api/health']
})

export async function middleware(request: NextRequest) {
  // CSRF for state-changing requests
  if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
    await csrfProtect(request, response)
  }
  // ... existing auth logic
}
```

---

### 1.3 Authentication Consolidation

**Files:** 15+ API routes, `lib/auth-client.ts`, `lib/auth-server.ts`

**Effort:** 4-5 hours

#### 1.3.1 Unified Auth Middleware

```typescript
// lib/middleware/auth.ts
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  // Try Bearer token first (API clients, mobile)
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    // Use getUser(), NOT getSession() (security critical)
    const { data, error } = await supabase.auth.getUser(token)
    if (!error && data.user) {
      return { user: data.user, error: null }
    }
  }

  // Fall back to cookie session (web clients)
  const { data: { user } } = await supabase.auth.getUser()
  return { user, error: user ? null : 'Unauthorized' }
}
```

#### 1.3.2 Fix Refresh Token Misuse

**Problem:** 12+ routes use access token as refresh token

```typescript
// BEFORE (broken - in 12+ files)
const { data } = await supabase.auth.setSession({
  access_token: token,
  refresh_token: token // ❌ Wrong!
})

// AFTER (correct)
const { data } = await supabase.auth.getUser(token)
// Don't manually manage sessions, let middleware handle it
```

**Closes:** voice-memory-y6h

#### 1.3.3 Align Admin Email Checks

**Problem:** 4 different admin patterns

```typescript
// lib/auth/admin.ts (NEW - single source of truth)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())

export function isAdmin(email: string): boolean {
  // Remove @voicememory.test backdoor (security vulnerability)
  return ADMIN_EMAILS.includes(email)
}

// Update lib/auth-client.ts and lib/auth-server.ts to use this
```

**Closes:** voice-memory-wsx

---

### 1.4 Fix Real-time Subscriptions

**Files:** `app/services/RealtimeManager.ts`, `app/services/PollingManager.ts`

**Effort:** 1-2 hours

#### 1.4.1 Fix RealtimeManager

```typescript
// app/services/RealtimeManager.ts line 131-142
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'task_states', // ✅ Changed from task_pins
  filter: `user_id=eq.${this.userId}`
}, this.handleChange)
```

#### 1.4.2 Fix PollingManager (MISSING FROM ORIGINAL)

```typescript
// app/services/PollingManager.ts
// Same change - target task_states instead of task_pins
const { data } = await supabase
  .from('task_states') // ✅ Changed from task_pins
  .select('*')
  .eq('user_id', userId)
```

**Closes:** voice-memory-bnk (PollingManager fix)

---

## Phase 2: Code Quality & Cleanup (Week 2)

### 2.1 Remove Deprecated Code

**Files:** `lib/processing-service.ts`, `app/components/*.tsx`

```bash
# Delete duplicate files
rm "app/components/UploadButton 2.tsx"
rm "app/components/AnalysisDashboard 2.tsx"

# Verify no imports before deleting legacy service
grep -r "processing-service" --include="*.ts" --include="*.tsx"
rm lib/processing-service.ts
```

---

### 2.2 Type Safety Improvements

**Priority Files:**
1. `lib/openai.ts` - 15+ `any` instances
2. `app/components/AnalysisView.tsx` - 10+ instances
3. `app/hooks/usePinnedTasksApi.ts` - 5+ instances

**Add ESLint rule:**
```json
// .eslintrc.json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error"
  }
}
```

---

### 2.3 Structured Logger

```typescript
// lib/utils/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export const logger = {
  debug: (msg: string, data?: object) => log('debug', msg, data),
  info: (msg: string, data?: object) => log('info', msg, data),
  warn: (msg: string, data?: object) => log('warn', msg, data),
  error: (msg: string, data?: object) => log('error', msg, data),
}

function log(level: LogLevel, message: string, data?: object) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  }))
}
```

---

### 2.4 Voice Processing Improvements

#### 2.4.1 Transcription Quality Validation

```typescript
// lib/openai.ts
const transcription = await openai.audio.transcriptions.create({
  file: file,
  model: 'whisper-1',
  response_format: 'verbose_json', // ✅ Get confidence scores
  language: 'en'
})

// Validate quality
if (transcription.text.split(' ').length < 3) {
  throw new Error('Transcription too short - audio may be corrupted')
}

const avgNoSpeech = transcription.segments
  .reduce((sum, s) => sum + (s.no_speech_prob || 0), 0) / transcription.segments.length

if (avgNoSpeech > 0.9) {
  throw new Error('No speech detected - check audio input')
}
```

---

## Phase 3: Performance & Database (Week 3-4)

### 3.1 Fix Memory Leaks

**Files:** `lib/security/file-validation.ts:543`, `lib/processing/ProcessingService.ts:798`

```typescript
// Add cleanup interval for rate limiter
const CLEANUP_INTERVAL = 5 * 60 * 1000
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of uploadAttempts) {
    if (value.resetTime < now) uploadAttempts.delete(key)
  }
}, CLEANUP_INTERVAL)

// Replace singleton with factory
export function createProcessingService(): ProcessingService {
  return new ProcessingService()
}
```

---

### 3.2 Database Improvements

**Migration Files:**

1. `supabase/migrations/20260102_add_task_states_fk.sql`
2. `supabase/rollbacks/20260102_add_task_states_fk.rollback.sql`

```sql
-- Forward migration
ALTER TABLE task_states
ADD CONSTRAINT task_states_note_id_fkey
FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE;

-- Rollback (create separately)
-- ALTER TABLE task_states DROP CONSTRAINT IF EXISTS task_states_note_id_fkey;
```

---

### 3.3 AI Cost Optimization

**Estimated Savings:** 40-60% reduction in OpenAI costs

```typescript
// lib/ai/model-router.ts
function selectModel(transcription: string): 'gpt-4o' | 'gpt-4o-mini' {
  const wordCount = transcription.split(/\s+/).length
  const hasComplexEntities = /meeting|project|deadline|follow-up/i.test(transcription)

  // Simple transcriptions → GPT-4o-mini (95% cheaper)
  if (wordCount < 100 && !hasComplexEntities) {
    return 'gpt-4o-mini'
  }
  return 'gpt-4o'
}
```

---

### 3.4 Database Atomicity

**Fixes:** voice-memory-u5g, voice-memory-17j, voice-memory-2na

```sql
-- supabase/migrations/20260103_fix_reorder_rpc.sql
CREATE OR REPLACE FUNCTION reorder_pinned_tasks(
  p_user_id UUID,
  p_task_orders JSONB
)
RETURNS void AS $$
BEGIN
  -- User validation (SECURITY FIX)
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user_id mismatch';
  END IF;

  UPDATE task_states
  SET pin_order = (elem->>'pin_order')::integer,
      updated_at = NOW()
  FROM jsonb_array_elements(p_task_orders) AS elem
  WHERE task_states.id = (elem->>'id')::bigint
    AND task_states.user_id = p_user_id
    AND task_states.pinned = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Closes:** voice-memory-17j

---

### 3.5 Performance Optimizations

**Fixes:** voice-memory-9yw, voice-memory-wdy, voice-memory-atq, voice-memory-ogp, voice-memory-w7z

#### 3.5.1 Fix SELECT * Queries

```typescript
// lib/database/queries.ts
const TASK_LIST_PROJECTION = 'id, analysis, processed_at, created_at'
const NOTE_DETAIL_PROJECTION = '*'

// Update all 22+ queries to use projections
```

**Closes:** voice-memory-9yw

#### 3.5.2 Fix N+1 Queries

```typescript
// app/api/tasks/route.ts
// Combine 4 sequential queries into 1 with join
const { data } = await supabase
  .from('task_states')
  .select(`
    *,
    note:notes!inner(id, analysis, transcription)
  `)
  .eq('user_id', userId)
```

**Closes:** voice-memory-wdy

#### 3.5.3 Add Polling Backoff

```typescript
// app/services/PollingManager.ts
class AdaptivePolling {
  private interval = 5000
  private consecutiveSuccesses = 0

  async poll() {
    const success = await this.fetchUpdates()
    if (success) {
      this.consecutiveSuccesses++
      if (this.consecutiveSuccesses > 10) {
        // Slow down if stable
        this.interval = Math.min(60000, this.interval * 1.5)
      }
    } else {
      this.interval = 5000 // Reset on failure
    }
  }
}
```

**Closes:** voice-memory-atq

#### 3.5.4 Enable Virtualization

```typescript
// app/components/VirtualizedNoteList.tsx
// Remove overscanRowCount: Infinity and enable virtualization
<AutoSizer>
  {({ height, width }) => (
    <List
      height={height}
      width={width}
      rowCount={notes.length}
      rowHeight={100}
      rowRenderer={renderNote}
      overscanRowCount={5} // ✅ Enable virtualization
    />
  )}
</AutoSizer>
```

**Closes:** voice-memory-w7z

---

## Phase 4: Testing & Accessibility (Week 5-6)

### 4.1 Test Coverage

**Target:** 70%+ overall, 80%+ for critical services

**Priority Tests:**
1. `__tests__/services/AuthenticationService.test.ts` (NEW)
2. `__tests__/services/TaskStateService.test.ts` (NEW)
3. `__tests__/middleware/auth.test.ts` (NEW)
4. `__tests__/middleware/rate-limit.test.ts` (NEW)

---

### 4.2 Accessibility Fixes

1. Add `aria-live="polite"` to ToastProvider
2. Add keyboard handlers to UploadButton
3. Add focus trap to TaskSlideoutPanelNew
4. Add skip-to-main link in Layout
5. Add reduced motion support in globals.css

---

## Implementation Schedule (Revised)

| Week | Phase | Focus | Beads Closed |
|------|-------|-------|--------------|
| 0 | 0 | Pre-flight Validation | zp9, 7x6 |
| 1 | 1.1-1.4 | Security & Stability | des, d1v, bnk, wsx, y6h |
| 2 | 2.1-2.4 | Code Quality | - |
| 3 | 3.1-3.2 | Memory & Database | - |
| 4 | 3.3-3.5 | Performance | 9yw, wdy, atq, u5g, 17j, 2na, ogp, w7z |
| 5-6 | 4.1-4.2 | Testing & A11y | bv6 |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| TypeScript errors | Unknown | 0 |
| `any` usage | 100+ | < 10 |
| Test coverage | ~30% | 70%+ |
| Lighthouse a11y | Unknown | > 90 |
| Orphaned task_states | Unknown | 0 |
| Real-time accuracy | Broken | 100% |
| SELECT * queries | 22+ | 0 |
| GPT-4 cost | Baseline | -40-60% |
| Open beads | 16 | 0 |

---

## Rollback Procedures

Each migration includes a rollback script in `supabase/rollbacks/`:

```bash
# If migration fails
supabase db reset --linked
# Or run specific rollback
psql -f supabase/rollbacks/20260102_add_task_states_fk.rollback.sql
```

---

## References

- [Next.js Security CVE-2025-29927](https://nvd.nist.gov/vuln/detail/CVE-2025-29927)
- [Supabase SSR Auth Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [OpenAI GPT-4o-mini Pricing](https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/)
- [TypeScript Strict Mode Migration](https://www.figma.com/blog/inside-figma-a-case-study-on-strict-null-checks/)
