import { supabase } from "../supabaseClient";
import type { ParsedJob } from "../types";

/**
 * Call the parse-job edge function. Sends the user's access token so the
 * function's verify_jwt gate is satisfied. Throws with the function's error
 * message on failure so the caller can fall back to a blank row.
 */
export async function parseJob(input: {
  url?: string;
  text?: string;
}): Promise<ParsedJob> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in.");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-job`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
    },
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Parse failed (${res.status})`);
  }
  return data as ParsedJob;
}
