-- Add an application status field, separate from oa_status (which tracks the
-- OA/HireVue stage). Nullable, no default => "empty" by default.
-- Values used by the app: rejected | pending | interviewing | offer | dropped | oa
-- Run once in the Supabase SQL Editor.

alter table public.jobs
  add column if not exists status text;
