-- MATTY 7.0 FITNESS OS — SUPABASE SCHEMA
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. RUNS
create table if not exists runs (
  id uuid default gen_random_uuid() primary key,
  strava_id bigint unique,
  date date not null,
  session_type text default 'easy',
  distance_km numeric(5,2),
  duration_seconds integer,
  avg_pace_sec_per_km integer,
  avg_hr integer,
  max_hr integer,
  avg_cadence integer,
  avg_power integer,
  calories integer,
  elevation_gain integer,
  splits jsonb default '[]',
  notes text,
  created_at timestamptz default now()
);

-- 2. GYM SESSIONS
create table if not exists gym_sessions (
  id uuid default gen_random_uuid() primary key,
  -- WHOOP API v2 activity IDs are UUID strings.
  whoop_activity_id text unique,
  date date not null,
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer,
  strain numeric(4,1),
  avg_hr integer,
  max_hr integer,
  calories integer,
  muscle_groups text[] default '{}',
  notes text,
  created_at timestamptz default now()
);

-- 3. EXERCISES
create table if not exists exercises (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references gym_sessions(id) on delete cascade,
  name text not null,
  muscle_group text,
  sets jsonb default '[]',
  notes text,
  created_at timestamptz default now()
);

-- 4. RECOVERY
create table if not exists recovery (
  id uuid default gen_random_uuid() primary key,
  date date unique not null,
  recovery_score integer,
  hrv_ms numeric(6,2),
  resting_hr integer,
  skin_temp_celsius numeric(4,2),
  spo2_pct numeric(4,1),
  created_at timestamptz default now()
);

-- 5. SLEEP
create table if not exists sleep (
  id uuid default gen_random_uuid() primary key,
  date date unique not null,
  total_hours numeric(4,2),
  deep_hours numeric(4,2),
  rem_hours numeric(4,2),
  light_hours numeric(4,2),
  awake_minutes integer,
  sleep_score integer,
  respiratory_rate numeric(4,2),
  created_at timestamptz default now()
);

-- 6. HM PLAN (15-week plan, Jul 21 – Oct 18)
create table if not exists hm_plan (
  id uuid default gen_random_uuid() primary key,
  week_number integer not null,
  phase integer not null,
  phase_name text not null,
  day_of_week text not null,
  planned_date date not null,
  session_type text not null,
  description text,
  target_distance_km numeric(5,2),
  target_pace_min text,
  target_pace_max text,
  completed boolean default false,
  run_id uuid references runs(id),
  created_at timestamptz default now()
);

-- Enable RLS (Row Level Security) — open for now since personal app
alter table runs enable row level security;
alter table gym_sessions enable row level security;
alter table exercises enable row level security;
alter table recovery enable row level security;
alter table sleep enable row level security;
alter table hm_plan enable row level security;

-- Allow all operations with anon key (personal app)
create policy "Allow all" on runs for all using (true) with check (true);
create policy "Allow all" on gym_sessions for all using (true) with check (true);
create policy "Allow all" on exercises for all using (true) with check (true);
create policy "Allow all" on recovery for all using (true) with check (true);
create policy "Allow all" on sleep for all using (true) with check (true);
create policy "Allow all" on hm_plan for all using (true) with check (true);

-- Indexes for performance
create index if not exists runs_date_idx on runs(date desc);
create index if not exists gym_sessions_date_idx on gym_sessions(date desc);
create index if not exists recovery_date_idx on recovery(date desc);
create index if not exists sleep_date_idx on sleep(date desc);
create index if not exists hm_plan_date_idx on hm_plan(planned_date asc);
