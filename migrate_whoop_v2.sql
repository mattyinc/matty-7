-- Run once in the Supabase SQL Editor for databases created with the old schema.
-- WHOOP API v2 workout IDs are UUID strings, not bigint values.

alter table gym_sessions
  alter column whoop_activity_id type text
  using whoop_activity_id::text;
