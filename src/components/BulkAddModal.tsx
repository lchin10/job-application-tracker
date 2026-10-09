import { useEffect, useMemo, useState } from "react";
import type { Job } from "../types";
import { insertJobs } from "../lib/jobs";
import { parseBulk } from "../lib/bulk";
import { formatSalary, todayISO } from "../lib/format";
import { locationLabel } from "../lib/constants";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (jobs: Job[]) => void;
  jobs: Job[];
}

const key = (company?: string, role?: string) =>
  `${company ?? ""}|${role ?? ""}`.toLowerCase().trim();

/** Paste a table of applications, preview the parsed rows, add them all. */
export default function BulkAddModal({ open, onClose, onCreated, jobs }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setBusy(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Already-tracked rows (same link, or same company + role) are skipped.
  const tracked = useMemo(
    () => new Set(jobs.flatMap((j) => [j.job_url, key(j.company, j.role)]).filter(Boolean)),
    [jobs],
  );
  const rows = useMemo(
    () =>
      parseBulk(text).map((r) => ({
        ...r,
        dup: tracked.has(r.job_url ?? "") || tracked.has(key(r.company, r.role)),
      })),
    [text, tracked],
  );
  const toAdd = rows.filter((r) => !r.dup);

  if (!open) return null;

  async function handleAdd() {
    setBusy(true);
    setError(null);
    try {
      const date = todayISO();
      // One insert shares a single now(), so stamp created_at per row: the last
      // row gets the newest time, keeping table order in the default (asc) sort.
      const base = Date.now();
      onCreated(
        await insertJobs(
          toAdd.map(({ dup: _, ...r }, i) => ({
            ...r,
            date_applied: date,
            created_at: new Date(base - (toAdd.length - 1 - i) * 1000).toISOString(),
          })),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add jobs.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>Bulk add applications</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <label className="field">
            <span>
              Paste a table: Company, Role, Salary range, Job listing link, Location, Company size
            </span>
            <textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Header row first. Tab-separated, markdown, or one cell per line all work."
              autoFocus
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          {rows.length > 0 && (
            <div className="bulk-preview">
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Salary</th>
                    <th>Location</th>
                    <th>Size</th>
                    <th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={r.dup ? "muted" : undefined}>
                      <td>
                        {r.company}
                        {r.dup && " (already tracked)"}
                      </td>
                      <td>{r.role}</td>
                      <td>{formatSalary({ salary_min: r.salary_min ?? null, salary_max: r.salary_max ?? null, salary_currency: "USD" }) || "—"}</td>
                      <td>{r.location?.map(locationLabel).join(", ") ?? "—"}</td>
                      <td>{r.company_size ?? "—"}</td>
                      <td>{r.job_url ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="muted modal-hint">
            Date applied is set to today. Job descriptions are left blank.
          </p>

          <div className="modal-actions">
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={busy || toAdd.length === 0}
            >
              {busy ? "Adding…" : `Add ${toAdd.length} application${toAdd.length === 1 ? "" : "s"}`}
            </button>
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
