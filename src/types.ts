export type OaStatus = "none" | "pending" | "submitted" | "dropped";

/** One row of public.jobs. Mirrors the Postgres schema. */
export interface Job {
  id: string;
  user_id: string;

  // table columns
  company: string;
  role: string;
  date_applied: string | null; // ISO date (yyyy-mm-dd)
  location: string[] | null; // multi-select; values from LOCATIONS
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  company_size: string | null;
  oa_status: OaStatus;
  status:
    | "rejected"
    | "pending"
    | "interviewing"
    | "offer"
    | "dropped"
    | "oa"
    | null;
  interviews: number;

  // application materials prepared (multi-select stored as comma-joined text)
  extra_info: string | null;

  // big text (side panel)
  job_url: string | null;
  job_description: string | null;
  notes: string | null;

  created_at: string;
  updated_at: string;
}

/** Fields the AI parse step may return. */
export interface ParsedJob {
  company: string | null;
  role: string | null;
  location: string[] | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  company_size: string | null;
  job_description: string | null;
}
