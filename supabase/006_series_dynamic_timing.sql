-- ─────────────────────────────────────────────────────────────────────────────
-- ShortsPilot — Migration 006: Dynamic series timing + creative controls
--
-- Replaces the hard-coded length_seconds constraint with a soft duration range
-- and adds pacing_style / visual_style creative controls.
--
-- length_seconds is KEPT (nullable, backward compat for existing rows).
-- New rows should use min_seconds + max_seconds instead.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add new timing columns (nullable so existing rows are unaffected)
alter table public.series
  add column if not exists min_seconds  integer check (min_seconds  > 0),
  add column if not exists max_seconds  integer check (max_seconds  > 0),
  add column if not exists pacing_style text    check (pacing_style in ('fast', 'medium', 'slow')),
  add column if not exists visual_style text    check (visual_style in ('b-roll', 'talking-head', 'mixed'));

-- Make the old length_seconds nullable (it was previously NOT NULL).
-- Existing rows keep their value; new rows that use min/max can leave it null.
alter table public.series
  alter column length_seconds drop not null;

-- Backfill min/max for all existing rows from their current length_seconds value.
-- Uses an 80/120 percent band so existing series get sensible defaults.
update public.series
set
  min_seconds  = round(length_seconds * 0.8),
  max_seconds  = round(length_seconds * 1.2),
  pacing_style = 'medium',
  visual_style = 'mixed'
where length_seconds is not null
  and min_seconds is null;

-- Add a check constraint: if both are set, max must exceed min
alter table public.series
  add constraint series_duration_range_valid
    check (
      min_seconds is null
      or max_seconds is null
      or max_seconds > min_seconds
    );
