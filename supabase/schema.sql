-- Job Application Tracker — database schema.
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: uses "if not exists" / "or replace" / "drop policy if exists".

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- table columns
  company         text not null default '',
  role            text not null default '',
  date_applied    date default current_date,
  location        text[],   -- multi-select: remote, nyc, sf, seattle, boston, la, chicago, dc
  salary_min      integer,  -- in thousands: 120 = $120k
  salary_max      integer,  -- in thousands: 150 = $150k
  salary_currency text default 'USD',
  company_size    text,
  status          text,                  -- pending | rejected | interviewing | offer | dropped | oa
  oa_status       text default 'none',   -- none | pending | submitted | dropped
  interviews      integer default 0,
  extra_info      text,     -- comma-joined: Cover letter | Why us | Project/Technical | About me | Follow-up email | Other

  -- big text (side panel)
  job_url         text,
  job_description text,
  notes           text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Fast per-user listing, newest first.
create index if not exists jobs_user_id_created_at_idx
  on public.jobs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Keep updated_at fresh on every update
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_touch_updated_at on public.jobs;
create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — DO NOT SKIP.
-- The anon key ships in the public bundle; RLS is what restricts every row
-- to its owner.
-- ---------------------------------------------------------------------------
alter table public.jobs enable row level security;

drop policy if exists "select own" on public.jobs;
create policy "select own" on public.jobs
  for select using (auth.uid() = user_id);

drop policy if exists "insert own" on public.jobs;
create policy "insert own" on public.jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own" on public.jobs;
create policy "update own" on public.jobs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own" on public.jobs;
create policy "delete own" on public.jobs
  for delete using (auth.uid() = user_id);
