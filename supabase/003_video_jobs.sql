-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Video generation layer
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add video_url to content_queue (flat column — NOT inside the immutable package JSONB)
alter table public.content_queue
  add column if not exists video_url text default null;

-- 2. Extend status constraint to include video pipeline statuses
alter table public.content_queue
  drop constraint if exists content_queue_status_check;

alter table public.content_queue
  add constraint content_queue_status_check
  check (status in (
    'pending_review',
    'needs_edits',
    'approved',
    'video_rendering',
    'video_ready',
    'ready_to_publish',
    'rejected',
    'published'
  ));

-- 3. video_jobs table — one row per render attempt
--    Separate from content_queue so we can retry renders without touching the queue item.
create table if not exists public.video_jobs (
  id               uuid primary key default uuid_generate_v4(),
  queue_item_id    uuid not null references public.content_queue(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'queued'
                     check (status in ('queued', 'processing', 'completed', 'failed')),
  provider         text not null default 'creatomate',
  external_job_id  text,                   -- provider's render ID (for webhook matching)
  audio_url        text,                   -- OpenAI TTS MP3 in Supabase Storage
  video_url        text,                   -- final MP4 URL (set on completion)
  error_message    text,
  render_metadata  jsonb,                  -- full request payload (debug/audit)
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index if not exists video_jobs_queue_item_idx    on public.video_jobs (queue_item_id);
create index if not exists video_jobs_external_job_idx  on public.video_jobs (external_job_id);
create index if not exists video_jobs_user_id_idx       on public.video_jobs (user_id);

-- RLS
alter table public.video_jobs enable row level security;

create policy "Users can view their own video jobs"
  on public.video_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own video jobs"
  on public.video_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own video jobs"
  on public.video_jobs for update
  using (auth.uid() = user_id);
