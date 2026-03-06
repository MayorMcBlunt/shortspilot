-- ─────────────────────────────────────────────────────────────────────────────
-- ShortsPilot — Content Queue Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── content_queue ─────────────────────────────────────────────────────────────
-- One row per generation job. The full ContentPackage JSON lives in `package`.
-- Lightweight columns (title, hook, status) allow fast list queries
-- without reading the full JSONB blob.

create table public.content_queue (
  id              uuid primary key default uuid_generate_v4(),
  job_id          uuid not null unique,
  user_id         uuid not null references auth.users(id) on delete cascade,
  series_id       uuid not null references public.series(id) on delete cascade,
  platform        text not null check (platform in ('tiktok', 'instagram', 'youtube')),
  status          text not null default 'pending_review' check (
                    status in ('pending_review', 'approved', 'rejected', 'needs_edits', 'published')
                  ),
  title           text not null,
  hook            text not null,
  package         jsonb not null,           -- full ContentPackage blob
  review_notes    text,
  approved_at     timestamptz,
  rejected_at     timestamptz,
  rejection_reason text,
  generated_at    timestamptz not null,
  created_at      timestamptz not null default now()
);

-- Indexes for common query patterns
create index content_queue_user_id_idx     on public.content_queue (user_id);
create index content_queue_series_id_idx   on public.content_queue (series_id);
create index content_queue_status_idx      on public.content_queue (status);
create index content_queue_created_at_idx  on public.content_queue (created_at desc);

-- Row Level Security
alter table public.content_queue enable row level security;

create policy "Users can view their own queue items"
  on public.content_queue for select
  using (auth.uid() = user_id);

create policy "Users can insert their own queue items"
  on public.content_queue for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own queue items"
  on public.content_queue for update
  using (auth.uid() = user_id);

-- No delete policy — items should be rejected, not deleted.
-- Add one here if you want to allow deletion:
-- create policy "Users can delete their own queue items"
--   on public.content_queue for delete
--   using (auth.uid() = user_id);


-- ── content_queue_events ──────────────────────────────────────────────────────
-- Immutable audit log. Every status change is recorded here.
-- Useful for debugging, analytics, and understanding review history.

create table public.content_queue_events (
  id              uuid primary key default uuid_generate_v4(),
  queue_item_id   uuid not null references public.content_queue(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  event           text not null,   -- 'approved', 'rejected', 'needs_edits', etc.
  notes           text,
  created_at      timestamptz not null default now()
);

create index content_queue_events_item_idx on public.content_queue_events (queue_item_id);

alter table public.content_queue_events enable row level security;

create policy "Users can view their own queue events"
  on public.content_queue_events for select
  using (auth.uid() = user_id);

create policy "Users can insert their own queue events"
  on public.content_queue_events for insert
  with check (auth.uid() = user_id);

-- Events are append-only — no update or delete policies
