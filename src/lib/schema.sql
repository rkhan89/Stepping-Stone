-- One table. `state` stays jsonb on purpose: the Run shape is still moving
-- (outline, steps, outcomes and cv have all changed shape this week) and
-- normalising it now would mean a migration every time we touch it. Normalise
-- once it stops moving.

create table if not exists runs (
  id          uuid primary key default gen_random_uuid(),
  -- An anonymous cookie id today. Becomes a real user id at registration,
  -- which is why it is text and not a foreign key yet.
  owner_id    text        not null,
  goal        text        not null,
  state       jsonb       not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Every read is "the newest run for this owner".
create index if not exists runs_owner_updated_idx
  on runs (owner_id, updated_at desc);
