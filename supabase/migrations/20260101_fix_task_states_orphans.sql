-- Fix Orphaned task_states Records and Add FK Constraint
-- Issue: voice-memory-zp9
--
-- Problem: task_states table has note_id values that reference deleted notes,
-- preventing addition of FK constraint.
--
-- Solution:
-- 1. Delete orphaned records (note_id not in notes table)
-- 2. Delete records with NULL note_id
-- 3. Add NOT NULL constraint
-- 4. Add FK constraint with CASCADE delete

-- =============================================================================
-- STEP 1: Log orphaned records before deletion (for audit)
-- =============================================================================

DO $$
DECLARE
    orphan_count INTEGER;
    null_count INTEGER;
BEGIN
    -- Count orphaned records
    SELECT COUNT(*) INTO orphan_count
    FROM public.task_states ts
    WHERE ts.note_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.notes n WHERE n.id = ts.note_id);

    -- Count NULL note_id records
    SELECT COUNT(*) INTO null_count
    FROM public.task_states ts
    WHERE ts.note_id IS NULL;

    RAISE NOTICE 'Found % orphaned task_states records (note_id references deleted notes)', orphan_count;
    RAISE NOTICE 'Found % task_states records with NULL note_id', null_count;
END
$$;

-- =============================================================================
-- STEP 2: Delete orphaned records (note_id references non-existent notes)
-- =============================================================================

DELETE FROM public.task_states ts
WHERE ts.note_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.notes n WHERE n.id = ts.note_id);

-- =============================================================================
-- STEP 3: Delete records with NULL note_id
-- =============================================================================

DELETE FROM public.task_states ts
WHERE ts.note_id IS NULL;

-- =============================================================================
-- STEP 4: Verify no orphans remain
-- =============================================================================

DO $$
DECLARE
    remaining_orphans INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_orphans
    FROM public.task_states ts
    WHERE ts.note_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.notes n WHERE n.id = ts.note_id);

    IF remaining_orphans > 0 THEN
        RAISE EXCEPTION 'Still have % orphaned records - cannot add FK constraint', remaining_orphans;
    END IF;

    RAISE NOTICE 'All orphaned records deleted - ready for FK constraint';
END
$$;

-- =============================================================================
-- STEP 5: Add NOT NULL constraint if not already present
-- =============================================================================

-- Check if column allows NULL and alter if needed
DO $$
BEGIN
    -- Only alter if currently nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'task_states'
          AND column_name = 'note_id'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public.task_states ALTER COLUMN note_id SET NOT NULL;
        RAISE NOTICE 'Added NOT NULL constraint to note_id';
    ELSE
        RAISE NOTICE 'note_id already has NOT NULL constraint';
    END IF;
END
$$;

-- =============================================================================
-- STEP 6: Add FK constraint if not already present
-- =============================================================================

DO $$
BEGIN
    -- Check if FK constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
          AND table_schema = 'public'
          AND table_name = 'task_states'
          AND constraint_name = 'task_states_note_id_fkey'
    ) THEN
        ALTER TABLE public.task_states
        ADD CONSTRAINT task_states_note_id_fkey
        FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;

        RAISE NOTICE 'Added FK constraint task_states_note_id_fkey';
    ELSE
        RAISE NOTICE 'FK constraint task_states_note_id_fkey already exists';
    END IF;
END
$$;

-- =============================================================================
-- STEP 7: Final verification
-- =============================================================================

DO $$
DECLARE
    has_fk BOOLEAN;
    is_not_null BOOLEAN;
BEGIN
    -- Verify FK exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_type = 'FOREIGN KEY'
          AND table_schema = 'public'
          AND table_name = 'task_states'
          AND constraint_name = 'task_states_note_id_fkey'
    ) INTO has_fk;

    -- Verify NOT NULL
    SELECT is_nullable = 'NO'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_states'
      AND column_name = 'note_id'
    INTO is_not_null;

    IF has_fk AND is_not_null THEN
        RAISE NOTICE '✅ Migration complete: task_states.note_id is NOT NULL with FK to notes(id)';
    ELSE
        RAISE EXCEPTION '❌ Migration verification failed: has_fk=%, is_not_null=%', has_fk, is_not_null;
    END IF;
END
$$;
