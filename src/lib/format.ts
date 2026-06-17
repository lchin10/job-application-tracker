import type { Job } from "../types";

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
};

/** Values are stored in thousands: 120 -> "120k". */
function compact(n: number): string {
  return `${n}k`;
}

/**
 * Render a salary range from min/max, where the stored values are in thousands.
 *   120–150 USD -> "$120k–150k"
 *   120 only    -> "$120k+"
 *   max 150 only-> "up to $150k"
 *   neither     -> ""
 */
export function formatSalary(job: Pick<Job, "salary_min" | "salary_max" | "salary_currency">): string {
  const { salary_min, salary_max } = job;
  if (salary_min == null && salary_max == null) return "";

  const sym = CURRENCY_SYMBOL[job.salary_currency ?? "USD"] ?? "";

  if (salary_min != null && salary_max != null) {
    return `${sym}${compact(salary_min)}–${compact(salary_max)}`;
  }
  if (salary_min != null) return `${sym}${compact(salary_min)}+`;
  return `up to ${sym}${compact(salary_max as number)}`;
}

/** Today's date as a local yyyy-mm-dd string (no UTC shift). */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Format an ISO date (yyyy-mm-dd) as a short local-ish label. */
export function formatDate(iso: string | null): string {
  if (!iso) return "";
  // Treat the date as plain calendar date (no timezone shift).
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
