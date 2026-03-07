-- Migration 005: Publishing Phase 1 (YouTube-first)

create table if not exists public.connected_accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('youtube')),
  account_external_id text not null,
  account_name text,
  scopes text[] not null default '{}',
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  is_active boolean not null default true,
  connected_at timestamptz not null default now(),
  last_refreshed_at timestamptz,
  disconnected_at timestamptz,
  unique (user_id, platform, account_external_id)
);

create index if not exists connected_accounts_user_platform_idx
  on public.connected_accounts (user_id, platform, is_active);

alter table public.connected_accounts enable row level security;

drop policy if exists "Users can view their own connected accounts" on public.connected_accounts;
create policy "Users can view their own connected accounts"
  on public.connected_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own connected accounts" on public.connected_accounts;
create policy "Users can insert their own connected accounts"
  on public.connected_accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own connected accounts" on public.connected_accounts;
create policy "Users can update their own connected accounts"
  on public.connected_accounts for update
  using (auth.uid() = user_id);

create table if not exists public.oauth_states (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('youtube')),
  state text not null unique,
  code_verifier_encrypted text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_states_user_idx on public.oauth_states (user_id);
create index if not exists oauth_states_expires_idx on public.oauth_states (expires_at);

alter table public.oauth_states enable row level security;

drop policy if exists "Users can view their own oauth states" on public.oauth_states;
create policy "Users can view their own oauth states"
  on public.oauth_states for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own oauth states" on public.oauth_states;
create policy "Users can insert their own oauth states"
  on public.oauth_states for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own oauth states" on public.oauth_states;
create policy "Users can update their own oauth states"
  on public.oauth_states for update
  using (auth.uid() = user_id);

create table if not exists public.publish_jobs (
  id uuid primary key default uuid_generate_v4(),
  queue_item_id uuid not null references public.content_queue(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('youtube')),
  connected_account_id uuid not null references public.connected_accounts(id) on delete restrict,
  status text not null default 'queued' check (status in (
    'queued',
    'validating',
    'refreshing_token',
    'uploading',
    'processing',
    'completed',
    'failed',
    'canceled'
  )),
  title text,
  description text,
  external_post_id text,
  external_post_url text,
  error_message text,
  attempt_count integer not null default 1,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists publish_jobs_user_idx on public.publish_jobs (user_id, created_at desc);
create index if not exists publish_jobs_queue_idx on public.publish_jobs (queue_item_id, created_at desc);
create index if not exists publish_jobs_status_idx on public.publish_jobs (status);

alter table public.publish_jobs enable row level security;

drop policy if exists "Users can view their own publish jobs" on public.publish_jobs;
create policy "Users can view their own publish jobs"
  on public.publish_jobs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own publish jobs" on public.publish_jobs;
create policy "Users can insert their own publish jobs"
  on public.publish_jobs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own publish jobs" on public.publish_jobs;
create policy "Users can update their own publish jobs"
  on public.publish_jobs for update
  using (auth.uid() = user_id);

alter table public.content_queue
  add column if not exists published_at timestamptz,
  add column if not exists published_url text,
  add column if not exists last_publish_job_id uuid references public.publish_jobs(id) on delete set null;
