-- APPLE FITNESS SHORTCUT IMPORT
-- Run once in the Supabase SQL Editor before enabling the Shortcut.

alter table public.runs
  add column if not exists source text not null default 'manual',
  add column if not exists apple_workout_id text;

create unique index if not exists runs_apple_workout_id_unique
  on public.runs (apple_workout_id);

create index if not exists runs_source_date_idx
  on public.runs (source, date desc);

update public.runs
set source = 'strava'
where strava_id is not null
  and source = 'manual';
