-- Add a "pinned" flag so important applications can be stuck to the top of the
-- table, regardless of the active sort. Defaults to false for existing rows.
-- Run once in the Supabase SQL Editor.

alter table public.jobs
  add column if not exists pinned boolean not null default false;
