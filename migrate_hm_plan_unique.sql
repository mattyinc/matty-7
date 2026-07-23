-- Optional one-time migration for databases created with the original schema.
-- Keeps the most useful row per date, removes duplicate plan rows, then adds
-- the uniqueness required for ON CONFLICT (planned_date).

with ranked as (
  select
    id,
    row_number() over (
      partition by planned_date
      order by completed desc, created_at asc, id asc
    ) as duplicate_number
  from hm_plan
)
delete from hm_plan
where id in (
  select id from ranked where duplicate_number > 1
);

create unique index if not exists hm_plan_planned_date_unique
  on hm_plan(planned_date);
