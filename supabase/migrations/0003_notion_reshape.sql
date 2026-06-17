-- Reshape to match the Notion structure:
--   * replace the six material subfields with a single `extra_info` text column
--   * salaries are now stored in THOUSANDS (120 = $120k)
-- Run once in the Supabase SQL Editor.

-- 1. New single materials column.
alter table public.jobs add column if not exists extra_info text;

-- 2. Drop the old per-material subfields.
alter table public.jobs drop column if exists cover_letter;
alter table public.jobs drop column if exists why_us;
alter table public.jobs drop column if exists project_technical;
alter table public.jobs drop column if exists about_me;
alter table public.jobs drop column if exists follow_up_email;
alter table public.jobs drop column if exists other;

-- 3. Convert any EXISTING full-dollar salaries to thousands.
--    Only run this block if you already have rows stored in full dollars
--    (e.g. 120000). Skip it for a fresh table / before the CSV import, since
--    the import already writes thousands. Running it twice would shrink values.
-- update public.jobs
--   set salary_min = round(salary_min / 1000.0),
--       salary_max = round(salary_max / 1000.0)
--   where salary_min > 1000 or salary_max > 1000;
