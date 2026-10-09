import { supabase } from "../supabaseClient";
import type { Job } from "../types";

/** All columns we read back from the table. */
const COLUMNS =
  "id, user_id, company, role, date_applied, location, salary_min, salary_max, " +
  "salary_currency, company_size, oa_status, status, interviews, pinned, extra_info, " +
  "job_url, job_description, notes, created_at, updated_at";

/**
 * Fetch all of the signed-in user's jobs, newest first. RLS scopes this to them.
 * Pages through the results because the API caps each response at max_rows (1000).
 */
export async function listJobs(): Promise<Job[]> {
  const PAGE = 1000;
  const out: Job[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("jobs")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as unknown as Job[]));
    if (!data || data.length < PAGE) return out;
  }
}

/**
 * Insert a new job. user_id defaults to auth.uid() in Postgres, so we don't
 * send it. date_applied defaults to today unless provided.
 */
export async function insertJob(values: Partial<Job> = {}): Promise<Job> {
  const { data, error } = await supabase
    .from("jobs")
    .insert(values)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as Job;
}

/** Insert many jobs in one request; returns the created rows. */
export async function insertJobs(values: Partial<Job>[]): Promise<Job[]> {
  const { data, error } = await supabase.from("jobs").insert(values).select(COLUMNS);
  if (error) throw error;
  return (data ?? []) as unknown as Job[];
}

/** Patch a job by id and return the updated row. */
export async function updateJob(
  id: string,
  patch: Partial<Job>,
): Promise<Job> {
  const { data, error } = await supabase
    .from("jobs")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as Job;
}

/** Delete a job by id. */
export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw error;
}
