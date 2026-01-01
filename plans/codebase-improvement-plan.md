# Voice Memory Codebase Improvement Plan

> Generated: January 2026
> Updated: January 2026 (Agent Review)
> Status: Planning Phase
> Tracking: Use `bd` (beads) for task management

---

## Executive Summary

This plan addresses **47+ identified issues** across 6 categories, organized into 4 phases over approximately 6-8 weeks. The improvements prioritize security and stability first, followed by code quality, performance, and maintainability.

### Agent Review Additions (January 2026)

Three domain-specific agents analyzed this plan and identified **critical gaps**:

| Agent | Critical Finding |
|-------|-----------------|
| **Voice Processing Engineer** | Video-to-audio extraction returns failure messages instead of working |
| **Analysis Enhancer** | Prompt output format doesn't match validation schema (silent failures) |
| **Supabase Data Architect** | Real-time subscriptions target wrong table (`task_pins` vs `task_states`) |

These findings have been incorporated into the phases below.

---

## Phase 1: Critical Security & Stability (Week 1-2)

### 1.1 TypeScript Configuration Fixes

| Task                                | File                     | Current State             | Target State     | Effort |
| ----------------------------------- | ------------------------ | ------------------------- | ---------------- | ------ |
| Enable strict mode                  | `tsconfig.json:11`       | `"strict": false`         | `"strict": true` | 4h     |
| Remove production ignoreBuildErrors | `next.config.js:172-174` | `ignoreBuildErrors: true` | Remove entirely  | 15m    |

**Implementation Steps:**

1. Enable `"strict": true` in `tsconfig.json`
2. Run `npx tsc --noEmit` to identify all type errors
3. Fix type errors incrementally (estimate 50-100 errors)
4. Remove `ignoreBuildErrors` from `next.config.js`
5. Verify build passes: `npm run build`

**Acceptance Criteria:**

- [ ] `npm run build` succeeds with strict mode
- [ ] No TypeScript errors in production build
- [ ] All `any` types in critical paths replaced

---

### 1.2 Security Hardening

| Task                        | File                           | Risk Level | Effort |
| --------------------------- | ------------------------------ | ---------- | ------ |
| Delete debug endpoints      | `app/api/debug-*/route.ts`     | CRITICAL   | 30m    |
| Add CSRF protection         | `middleware.ts`                | CRITICAL   | 2h     |
| Add rate limiting           | API routes                     | HIGH       | 3h     |
| Fix CSP unsafe-eval         | `next.config.js:134`           | HIGH       | 1h     |
| Remove service key fallback | `lib/supabase-server.ts:33-39` | MEDIUM     | 30m    |

**Implementation Steps:**

#### 1.2.1 Delete Debug Endpoints

```bash
# Files to delete
rm app/api/debug-supabase/route.ts
rm app/api/debug-client-env/route.ts
rm app/api/debug-auth-production/route.ts
```

#### 1.2.2 Add CSRF Protection

Create `lib/middleware/csrf.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createHash, randomBytes } from 'crypto'

export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex')
}

export function validateCSRFToken(request: NextRequest): boolean {
  const token = request.headers.get('x-csrf-token')
  const cookieToken = request.cookies.get('csrf-token')?.value
  if (!token || !cookieToken) return false
  return token === cookieToken
}
```

#### 1.2.3 Add Rate Limiting

Create `lib/middleware/rate-limit.ts`:

```typescript
interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// Cleanup stale entries every 5 minutes
setInterval(
  () => {
    const now = Date.now()
    for (const [key, value] of rateLimitStore) {
      if (value.resetAt < now) rateLimitStore.delete(key)
    }
  },
  5 * 60 * 1000
)

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 100 }
): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitStore.get(identifier)

  if (!record || record.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.maxRequests - 1 }
  }

  if (record.count >= config.maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  record.count++
  return { allowed: true, remaining: config.maxRequests - record.count }
}
```

#### 1.2.4 Fix CSP

Update `next.config.js` line 134:

```javascript
// Before
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",

// After
"script-src 'self' 'unsafe-inline' https://vercel.live",
```

**Acceptance Criteria:**

- [ ] No debug endpoints accessible in production
- [ ] CSRF validation on all POST/PUT/DELETE requests
- [ ] Rate limiting returns 429 when exceeded
- [ ] CSP no longer allows `unsafe-eval`

---

### 1.3 Authentication Consolidation

| Task                           | Files Affected                                          | Effort |
| ------------------------------ | ------------------------------------------------------- | ------ |
| Create unified auth middleware | 15+ API routes                                          | 4h     |
| Fix refresh token misuse       | `upload/route.ts`, `notes/route.ts`, `process/route.ts` | 1h     |
| Align admin email checks       | `auth-client.ts`, `auth-server.ts`                      | 30m    |

**Implementation Steps:**

Create `lib/middleware/auth.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export interface AuthResult {
  user: User | null
  error: string | null
  supabase: SupabaseClient
}

export async function authenticateRequest(
  request: NextRequest
): Promise<AuthResult> {
  const supabase = createServerClient(/* config */)

  // Try Bearer token first
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data, error } = await supabase.auth.getUser(token)
    if (!error && data.user) {
      return { user: data.user, error: null, supabase }
    }
  }

  // Fall back to cookie session
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    return { user: null, error: error.message, supabase }
  }

  return { user: data.user, error: null, supabase }
}

export function requireAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest) => {
    const auth = await authenticateRequest(request)
    if (!auth.user) {
      return NextResponse.json(
        { error: 'Unauthorized', type: 'authentication' },
        { status: 401 }
      )
    }
    return handler(request, auth)
  }
}
```

**Acceptance Criteria:**

- [ ] Single `authenticateRequest()` function used across all routes
- [ ] No duplicate auth code in API routes
- [ ] Refresh tokens handled correctly (or removed)

---

### 1.4 Critical Data Integrity Fixes (Agent Review)

> ⚠️ **CRITICAL**: These issues cause silent failures in production.

| Task | File | Risk Level | Effort |
|------|------|------------|--------|
| Fix real-time subscription table | `app/services/RealtimeManager.ts:131-142` | CRITICAL | 30m |
| Add task_states FK constraint | `supabase/migrations/` | CRITICAL | 1h |
| Fix prompt/validation schema mismatch | `lib/analysis.ts`, `lib/validation.ts` | HIGH | 4h |

#### 1.4.1 Fix Real-time Subscription Table Mismatch

**Problem:** `RealtimeManager` subscribes to `task_pins` but the app uses `task_states`.

```typescript
// app/services/RealtimeManager.ts - BEFORE (broken)
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'task_pins',  // ❌ Wrong table
  filter: `user_id=eq.${this.userId}`
}, handleChange)

// AFTER (fixed)
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'task_states',  // ✅ Correct table
  filter: `user_id=eq.${this.userId}`
}, handleChange)
```

#### 1.4.2 Add Foreign Key Constraint

**Problem:** `task_states.note_id` has no FK constraint, allowing orphaned records.

```sql
-- supabase/migrations/20260102_add_task_states_fk.sql
ALTER TABLE task_states
ADD CONSTRAINT task_states_note_id_fkey
FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE;

-- Rollback script (save to supabase/rollbacks/)
-- ALTER TABLE task_states DROP CONSTRAINT IF EXISTS task_states_note_id_fkey;
```

#### 1.4.3 Fix Prompt/Validation Schema Mismatch

**Problem:** `analysis.ts` prompt returns 7 fields, but `validation.ts` expects 15+ fields. This causes validation failures silently recovered via `createPartialAnalysis()`.

**Options:**
1. Update prompt to return full BIB framework fields (recommended)
2. Simplify validation schema to match current prompt

**Acceptance Criteria:**

- [ ] Real-time updates work for task state changes
- [ ] No orphaned task_states after note deletion
- [ ] Analysis validation passes without fallback recovery

---

## Phase 2: Code Quality & Cleanup (Week 2-3)

### 2.1 Remove Deprecated Code

| Task                             | File                        | Lines   | Effort |
| -------------------------------- | --------------------------- | ------- | ------ |
| Remove legacy processing service | `lib/processing-service.ts` | 1100    | 2h     |
| Delete duplicate components      | `app/components/*.tsx`      | 2 files | 15m    |
| Clean up empty useEffect         | `app/page.tsx:31-34`        | 4       | 5m     |

**Files to Delete:**

```bash
rm "app/components/UploadButton 2.tsx"
rm "app/components/AnalysisDashboard 2.tsx"
```

**Files to Refactor:**

- `lib/processing-service.ts` → Ensure all imports use `lib/processing/ProcessingService.ts`
- Update any remaining references, then delete legacy file

---

### 2.2 Type Safety Improvements

| Category            | Files                     | Est. Fixes | Effort |
| ------------------- | ------------------------- | ---------- | ------ |
| API response types  | `app/api/**/*.ts`         | 25         | 3h     |
| Component props     | `app/components/**/*.tsx` | 30         | 4h     |
| Service layer       | `lib/services/**/*.ts`    | 20         | 2h     |
| Processing pipeline | `lib/processing/**/*.ts`  | 25         | 3h     |

**Priority Files (most `any` usage):**

1. `lib/openai.ts` - 15+ instances
2. `lib/processing-service.ts` - 30+ instances (delete after migration)
3. `app/components/AnalysisView.tsx` - 10+ instances
4. `app/hooks/usePinnedTasksApi.ts` - 5+ instances

**Type Definitions to Create:**

```typescript
// lib/types/analysis.ts
export interface AnalysisResult {
  sentiment: SentimentAnalysis
  topics: Topic[]
  tasks: TaskExtraction
  ideas: Idea[]
  messages: Message[]
  crossReferences: CrossReference[]
  outreach: OutreachSuggestion[]
}

// lib/types/supabase.ts
export type TypedSupabaseClient = SupabaseClient<Database>
```

---

### 2.3 Error Handling Standardization

| Task                 | Current State          | Target State                      |
| -------------------- | ---------------------- | --------------------------------- |
| API error responses  | Mixed formats          | Standardized `ErrorResponse`      |
| Service layer errors | Throws vs returns      | Consistent `Result<T, E>` pattern |
| Console logging      | 100+ unstructured logs | Structured logger with levels     |

**Create `lib/utils/logger.ts`:**

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export const logger = {
  debug: (msg: string, data?: object) => log('debug', msg, data),
  info: (msg: string, data?: object) => log('info', msg, data),
  warn: (msg: string, data?: object) => log('warn', msg, data),
  error: (msg: string, data?: object) => log('error', msg, data),
}

function log(level: LogLevel, message: string, data?: object) {
  if (LEVELS[level] < LEVELS[LOG_LEVEL as LogLevel]) return

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  }

  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}
```

---

### 2.4 Voice Processing Improvements (Agent Review)

| Task | File | Impact | Effort |
|------|------|--------|--------|
| Add transcription quality validation | `lib/openai.ts` | HIGH | 3h |
| Complete video-to-audio extraction | `lib/video-processor.ts` | MEDIUM | 4h |
| Unify audio conversion services | Multiple files | MEDIUM | 3h |

#### 2.4.1 Transcription Quality Validation

**Problem:** No validation that Whisper output is meaningful. Garbage audio produces garbage transcriptions silently.

```typescript
// lib/openai.ts - Use verbose_json for quality metrics
const transcription = await openai.audio.transcriptions.create({
  file: file,
  model: 'whisper-1',
  response_format: 'verbose_json',  // ✅ Get word-level confidence
  language: 'en',
})

// Add validation
function validateTranscription(result: WhisperVerboseResponse): boolean {
  // Reject if too short or low confidence
  if (result.text.split(' ').length < 3) return false
  if (result.segments?.some(s => s.no_speech_prob > 0.9)) return false
  return true
}
```

#### 2.4.2 Complete Video-to-Audio Extraction

**Problem:** `lib/video-processor.ts` returns failure messages instead of extracting audio.

```typescript
// Current (broken) - line 133-188
return {
  success: false,
  error: `Video file detected but audio extraction not yet implemented...`
}

// Fix: Implement FFmpeg integration or use ffmpeg.wasm for Vercel
```

#### 2.4.3 Unify Audio Conversion

**Problem:** Three overlapping conversion implementations with inconsistent parameters:
- `lib/client-audio-converter.ts` - Client-side, 64kbps MP3
- `lib/processing/AudioFormatNormalizationService.ts` - Server-side, 16kHz WAV
- Inline logic in `AudioProcessorService.ts`

**Solution:** Create unified `AudioConversionStrategy` with consistent 16kHz mono output.

---

## Phase 3: Performance & Database (Week 4-5)

### 3.1 Fix Memory Leaks & Singletons

| Issue                       | File                                      | Solution             | Effort |
| --------------------------- | ----------------------------------------- | -------------------- | ------ |
| Rate limiter memory leak    | `lib/security/file-validation.ts:543`     | Add cleanup interval | 30m    |
| ProcessingService singleton | `lib/processing/ProcessingService.ts:798` | Factory pattern      | 2h     |
| Timeout promise leak        | `CircuitBreakerService.ts:48-54`          | Clear timers         | 30m    |

**Fix for Rate Limiter:**

```typescript
// lib/security/file-validation.ts
const uploadAttempts = new Map<string, { count: number; resetTime: number }>()

// Add cleanup
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of uploadAttempts) {
    if (value.resetTime < now) {
      uploadAttempts.delete(key)
    }
  }
}, CLEANUP_INTERVAL)
```

**Fix for Singleton:**

```typescript
// lib/processing/ProcessingService.ts
// Replace singleton export with factory
export function createProcessingService(): ProcessingService {
  return new ProcessingService()
}

// In API routes
const processingService = createProcessingService()
```

---

### 3.2 Database Improvements

| Task                        | Location                      | Effort |
| --------------------------- | ----------------------------- | ------ |
| Add transaction support     | `TaskStateService.ts:341-359` | 2h     |
| Add foreign key constraints | `task_states.note_id`         | 1h     |
| Fix cascading deletes       | Schema migrations             | 1h     |

**Transaction Support:**

```typescript
// lib/services/TaskStateService.ts
async reorderPinnedTasks(updates: TaskUpdate[]): Promise<void> {
  // Use Supabase RPC for atomic updates
  const { error } = await this.supabase.rpc('reorder_pinned_tasks', {
    updates: JSON.stringify(updates)
  })

  if (error) throw new Error(`Reorder failed: ${error.message}`)
}
```

**Migration for Foreign Key:**

```sql
-- supabase/migrations/20260101_add_task_states_fk.sql
ALTER TABLE task_states
ADD CONSTRAINT task_states_note_id_fkey
FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE;
```

---

### 3.3 AI Cost Optimization (Agent Review)

| Task | File | Impact | Effort |
|------|------|--------|--------|
| Implement gpt-4o-mini tiering | `lib/openai.ts`, `lib/analysis.ts` | HIGH (40-60% savings) | 6h |
| Add token usage tracking | `lib/openai.ts` | MEDIUM | 4h |
| Implement prompt versioning | `lib/prompts/` | MEDIUM | 6h |

#### 3.3.1 GPT-4o-mini Tiered Model Selection

**Problem:** All transcriptions use `gpt-4o` regardless of complexity. Simple notes ("remind me to call mom") don't need GPT-4o capabilities.

```typescript
// lib/analysis.ts
function selectModel(transcription: string): string {
  const wordCount = transcription.split(/\s+/).length
  const hasComplexEntities = /meeting|project|deadline|follow-up/i.test(transcription)

  // Route simple transcriptions to cheaper model
  if (wordCount < 100 && !hasComplexEntities) {
    return process.env.OPENAI_SIMPLE_MODEL || 'gpt-4o-mini'
  }
  return process.env.OPENAI_MODEL || 'gpt-4o'
}

// Track model selection in metadata
const analysis = await analyze(transcription)
analysis.metadata = {
  model: selectedModel,
  wordCount,
  timestamp: new Date().toISOString()
}
```

**Estimated Impact:** 40-60% cost reduction for typical usage patterns.

#### 3.3.2 Token Usage Tracking

```typescript
// lib/openai.ts - Capture usage metrics
const completion = await openai.chat.completions.create({...})

// Store metrics
await supabase.from('analysis_metrics').insert({
  note_id: noteId,
  prompt_tokens: completion.usage?.prompt_tokens,
  completion_tokens: completion.usage?.completion_tokens,
  model: selectedModel,
  cost_estimate: calculateCost(completion.usage, selectedModel)
})
```

---

### 3.4 Database Atomicity (Agent Review)

| Task | File | Impact | Effort |
|------|------|--------|--------|
| Create atomic reorder RPC | `supabase/migrations/` | HIGH | 2h |
| Add updated_at triggers | `supabase/migrations/` | MEDIUM | 1h |

#### 3.4.1 Atomic Pin Reorder

**Problem:** `reorderPinnedTasks` performs sequential updates without transaction protection.

```sql
-- supabase/migrations/20260103_reorder_pinned_tasks_rpc.sql
CREATE OR REPLACE FUNCTION reorder_pinned_tasks(
    p_user_id UUID,
    p_task_orders JSONB -- [{"id": "...", "pin_order": 1}, ...]
)
RETURNS void AS $$
BEGIN
    UPDATE task_states
    SET pin_order = (elem->>'pin_order')::integer,
        updated_at = NOW()
    FROM jsonb_array_elements(p_task_orders) AS elem
    WHERE task_states.id = (elem->>'id')::bigint
      AND task_states.user_id = p_user_id
      AND task_states.pinned = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reorder_pinned_tasks TO authenticated;
```

#### 3.4.2 Auto-update Triggers

```sql
-- supabase/migrations/20260104_updated_at_triggers.sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_task_states_updated_at
    BEFORE UPDATE ON task_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

---

### 3.5 Performance Optimizations

| Task                           | File               | Impact | Effort |
| ------------------------------ | ------------------ | ------ | ------ |
| Replace JSON.stringify in memo | `NoteCard.tsx:165` | High   | 1h     |
| Add input validation with Zod  | API routes         | Medium | 3h     |
| Implement server-side caching  | Heavy queries      | Medium | 4h     |

**Memo Optimization:**

```typescript
// lib/utils/compare.ts
export function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every((key) => a[key as keyof T] === b[key as keyof T])
}

// NoteCard.tsx
export default memo(NoteCard, (prev, next) => {
  return (
    prev.note.id === next.note.id &&
    prev.note.updated_at === next.note.updated_at &&
    prev.isExpanded === next.isExpanded
  )
})
```

---

## Phase 4: Testing & Accessibility (Week 5-6)

### 4.1 Increase Test Coverage

| Service                    | Current | Target | Priority |
| -------------------------- | ------- | ------ | -------- |
| AuthenticationService      | 0%      | 80%    | HIGH     |
| TaskStateService           | 0%      | 80%    | HIGH     |
| KnowledgeAggregatorService | 0%      | 70%    | MEDIUM   |
| API Routes                 | 20%     | 70%    | MEDIUM   |

**Test Files to Create:**

```
__tests__/
├── services/
│   ├── AuthenticationService.test.ts
│   ├── TaskStateService.test.ts
│   └── KnowledgeAggregatorService.test.ts
├── api/
│   ├── notes.test.ts
│   ├── tasks.test.ts
│   └── knowledge.test.ts
└── middleware/
    ├── auth.test.ts
    ├── csrf.test.ts
    └── rate-limit.test.ts
```

---

### 4.2 Accessibility Fixes

| Issue                       | File                       | Fix                      | Effort |
| --------------------------- | -------------------------- | ------------------------ | ------ |
| Missing aria-live on toasts | `ToastProvider.tsx:57`     | Add `aria-live="polite"` | 15m    |
| No keyboard on upload       | `UploadButton.tsx:343-356` | Add onKeyDown            | 30m    |
| Missing focus trap          | `TaskSlideoutPanelNew.tsx` | Add focus-trap-react     | 1h     |
| No skip link                | `Layout.tsx`               | Add skip-to-main         | 15m    |

**Toast Fix:**

```tsx
// app/components/ToastProvider.tsx
<div
  className="fixed top-4 right-4 z-50 space-y-2"
  role="region"
  aria-label="Notifications"
  aria-live="polite"
>
```

**Upload Keyboard Support:**

```tsx
// app/components/UploadButton.tsx
<div
  onClick={openFileDialog}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openFileDialog()
    }
  }}
  tabIndex={0}
  role="button"
  aria-label="Upload audio files"
>
```

**Reduced Motion Support:**

```css
/* globals.css */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Implementation Schedule

| Week | Phase | Focus | Deliverables |
| ---- | ----- | ----- | ------------ |
| 1 | 1.1, 1.2, **1.4** | Critical Security & Data Integrity | Strict TS, debug removal, CSRF, **real-time fix, FK constraint** |
| 2 | 1.3, 2.1 | Auth & Cleanup | Auth middleware, deprecated code removal |
| 3 | 2.2, 2.3, **2.4** | Type Safety & Voice Processing | Type definitions, error standardization, **transcription validation** |
| 4 | 3.1, 3.2, **3.4** | Memory & Database | Memory leaks, transactions, **atomic reorder RPC** |
| 5 | **3.3**, 3.5, 4.1 | **AI Cost Optimization** & Tests | **gpt-4o-mini tiering**, optimizations, test coverage |
| 6 | 4.2 | Accessibility | A11y fixes, final review |

---

## Risk Mitigation

| Risk                      | Impact | Mitigation                       |
| ------------------------- | ------ | -------------------------------- |
| Strict TS breaks build    | High   | Incremental fixes, feature flags |
| Auth changes break mobile | High   | Thorough E2E testing             |
| Database migrations fail  | High   | Test on staging first            |
| Performance regression    | Medium | Benchmark before/after           |

---

## Success Metrics

| Metric | Current | Target |
| ------ | ------- | ------ |
| TypeScript errors | Unknown (disabled) | 0 |
| `any` type usage | 100+ | < 10 |
| Test coverage | ~30% | 70% |
| Lighthouse a11y score | Unknown | > 90 |
| API response time (p95) | Unknown | < 500ms |
| Security vulnerabilities | 5+ critical | 0 critical |
| **Real-time subscription accuracy** | **Broken (wrong table)** | **100% working** |
| **Analysis validation pass rate** | **Unknown (silent failures)** | **> 95%** |
| **GPT-4 API cost** | **Baseline** | **40-60% reduction** |
| **Orphaned task_states** | **Unknown** | **0** |

---

## Tracking with Beads

After installing beads, create issues for each phase:

```bash
bd init
bd create "Phase 1: Critical Security & Stability" -p 0 --epic
bd create "Enable TypeScript strict mode" -p 0 --parent bd-<epic-id>
bd create "Delete debug endpoints" -p 0 --parent bd-<epic-id>
bd create "Add CSRF protection" -p 0 --parent bd-<epic-id>
# ... continue for all tasks
```

---

## Appendix: Files Reference

### Critical Files (Immediate Action)

- `tsconfig.json` - Enable strict
- `next.config.js` - Remove ignoreBuildErrors, fix CSP
- `middleware.ts` - Add CSRF
- `app/api/debug-*/*` - Delete
- **`app/services/RealtimeManager.ts:131-142`** - Fix subscription table (Agent Review)
- **`lib/analysis.ts` + `lib/validation.ts`** - Fix schema mismatch (Agent Review)

### High Priority Files

- `lib/processing-service.ts` - Delete after migration
- `lib/supabase-server.ts` - Fix service key fallback
- `app/api/*/route.ts` - Consolidate auth
- **`lib/openai.ts`** - Add gpt-4o-mini tiering, token tracking (Agent Review)
- **`lib/video-processor.ts`** - Complete video-to-audio extraction (Agent Review)

### Medium Priority Files

- `lib/security/file-validation.ts` - Fix memory leak
- `lib/processing/ProcessingService.ts` - Fix singleton
- `app/components/NoteCard.tsx` - Fix memo comparison
- `app/components/ToastProvider.tsx` - Add aria-live
- **`lib/services/TaskStateService.ts`** - Use atomic reorder RPC (Agent Review)

### New Migrations Required (Agent Review)

```
supabase/migrations/
├── 20260102_add_task_states_fk.sql          # FK constraint
├── 20260103_reorder_pinned_tasks_rpc.sql    # Atomic reorder
├── 20260104_updated_at_triggers.sql         # Auto-update triggers
└── 20260105_analysis_metrics_table.sql      # Cost tracking
```
