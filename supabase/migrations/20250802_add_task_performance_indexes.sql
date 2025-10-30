-- Migration: Add performance indexes for task operations
-- Created: 2025-08-02

-- Index for efficient task queries on notes table
CREATE INDEX IF NOT EXISTS idx_notes_user_analysis 
ON public.notes(user_id) 
WHERE analysis IS NOT NULL;

-- Composite index for task completions
CREATE INDEX IF NOT EXISTS idx_task_completions_user_task 
ON public.task_completions(user_id, task_id);

-- Composite index for task pins
CREATE INDEX IF NOT EXISTS idx_task_pins_user_task 
ON public.task_pins(user_id, task_id);

-- Optimize RLS with partial index for active completions
CREATE INDEX IF NOT EXISTS idx_task_completions_user_active 
ON public.task_completions(user_id, task_id) 
WHERE completed_at IS NOT NULL;

-- Index for efficient task pin ordering
CREATE INDEX IF NOT EXISTS idx_task_pins_user_order 
ON public.task_pins(user_id, pin_order) 
WHERE pin_order IS NOT NULL;