-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Add review_edits column + ready_to_publish status
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add review_edits JSONB column (nullable — null means no overrides yet)
alter table public.content_queue
  add column if not exists review_edits jsonb default null;

-- 2. Extend the status CHECK constraint to include ready_to_publish
--    Supabase doesn't support ALTER CONSTRAINT directly, so we drop + recreate.

alter table public.content_queue
  drop constraint if exists content_queue_status_check;

alter table public.content_queue
  add constraint content_queue_status_check
  check (status in (
    'pending_review',
    'needs_edits',
    'approved',
    'ready_to_publish',
    'rejected',
    'published'
  ));
