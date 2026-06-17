-- Migrate jobs.location from a single text value to a text[] array so a job
-- can have multiple locations. Run this once in the Supabase SQL Editor if you
-- created the table before location became multi-select.
--
-- Existing single values are wrapped into a one-element array; blanks/nulls
-- become null.

alter table public.jobs
  alter column location type text[]
  using case
    when location is null or location = '' then null
    else array[location]
  end;
