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

-- Applications the person logged themselves, after applying wherever they
-- normally look. Stepping Stone does not find these; it chases them.
create table if not exists applications (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references runs(id) on delete cascade,
  company        text not null,
  role_title     text not null,
  url            text,
  source         text,                 -- linkedin | indeed | company | recruiter | other
  applied_on     date not null,
  -- applied -> followed_up -> replied | interview | rejected | ghosted
  status         text not null default 'applied',
  follow_up_due  date,
  followed_up_on date,
  outcome_note   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- The entire nudge query: still sitting at 'applied' with a due date gone by.
create index if not exists applications_due_idx
  on applications (run_id, follow_up_due)
  where status = 'applied';

create index if not exists applications_run_idx
  on applications (run_id, applied_on desc);
