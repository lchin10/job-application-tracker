import { supabase } from "../supabaseClient";
import type { Job } from "../types";

/** All columns we read back from the table. */
const COLUMNS =
  "id, user_id, company, role, date_applied, location, salary_min, salary_max, " +
  "salary_currency, company_size, oa_status, status, interviews, extra_info, " +
  "job_url, job_description, notes, created_at, updated_at";

/** Fetch the signed-in user's jobs, newest first. RLS scopes this to them. */
export async function listJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Job[];
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
