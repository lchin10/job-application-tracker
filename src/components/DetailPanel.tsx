import { useEffect, useState } from "react";
import type { Job, OaStatus } from "../types";
import { updateJob, deleteJob } from "../lib/jobs";
import {
  COMPANY_SIZES,
  LOCATIONS,
  LOCATION_LABELS,
  LOCATION_COLORS,
  STATUSES,
  STATUS_COLORS,
  OA_COLORS,
  EXTRA_INFO,
  EXTRA_INFO_COLORS,
  splitExtraInfo,
  joinExtraInfo,
  type AppStatus,
} from "../lib/constants";
import MultiSelect from "./MultiSelect";

const LOCATION_OPTIONS = LOCATIONS.map((v) => ({
  value: v,
  label: LOCATION_LABELS[v],
  color: LOCATION_COLORS[v],
}));

const EXTRA_INFO_OPTIONS = EXTRA_INFO.map((v) => ({
  value: v,
  label: v,
  color: EXTRA_INFO_COLORS[v],
}));

interface Props {
  job: Job | null;
  onClose: () => void;
  onSaved: (updated: Job) => void;
  onDeleted: (id: string) => void;
}

const OA_OPTIONS: OaStatus[] = ["none", "pending", "submitted", "dropped"];

/** Empty string -> null for nullable text columns. */
function nn(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

/** Parse an integer input, empty -> null. */
function ni(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export default function DetailPanel({ job, onClose, onSaved, onDeleted }: Props) {
  const [draft, setDraft] = useState<Job | null>(job);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync the draft whenever a different job is opened.
  useEffect(() => {
    setDraft(job);
    setError(null);
  }, [job]);

  // Keep the panel mounted (for the slide animation) even when nothing is open.
  const open = job != null && draft != null;

  function set<K extends keyof Job>(key: K, value: Job[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const patch: Partial<Job> = {
        company: draft.company,
        role: draft.role,
        date_applied: nn(draft.date_applied ?? ""),
        location: draft.location && draft.location.length ? draft.location : null,
        salary_min: draft.salary_min,
        salary_max: draft.salary_max,
        salary_currency: nn(draft.salary_currency ?? "") ?? "USD",
        company_size: nn(draft.company_size ?? ""),
        oa_status: draft.oa_status,
        status: draft.status,
        interviews: draft.interviews ?? 0,
        extra_info: nn(draft.extra_info ?? ""),
        job_url: nn(draft.job_url ?? ""),
        job_description: nn(draft.job_description ?? ""),
        notes: nn(draft.notes ?? ""),
      };
      const updated = await updateJob(draft.id, patch);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft) return;
    const label = draft.company || draft.role || "this application";
    if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteJob(draft.id);
      onDeleted(draft.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
      setDeleting(false);
    }
  }

  return (
    <aside className={open ? "detail-panel is-open" : "detail-panel"}>
      {open && draft && (
        <>
          <button
            className="panel-close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
          <div className="detail-inner">
            <div className="detail-head">
              <h2>{draft.company || "New application"}</h2>
            </div>

          {error && <p className="auth-error">{error}</p>}

          {/* Core fields */}
          <div className="field-grid">
            <label className="field">
              <span>Company</span>
              <input value={draft.company} onChange={(e) => set("company", e.target.value)} />
            </label>
            <label className="field">
              <span>Role</span>
              <input value={draft.role} onChange={(e) => set("role", e.target.value)} />
            </label>
            <label className="field">
              <span>Date applied</span>
              <input
                type="date"
                value={draft.date_applied ?? ""}
                onChange={(e) => set("date_applied", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Location</span>
              <MultiSelect
                options={LOCATION_OPTIONS}
                value={draft.location ?? []}
                onChange={(next) => set("location", next.length ? next : null)}
              />
            </label>
            <label className="field">
              <span>Salary min (k)</span>
              <input
                type="number"
                value={draft.salary_min ?? ""}
                onChange={(e) => set("salary_min", ni(e.target.value))}
                placeholder="120"
              />
            </label>
            <label className="field">
              <span>Salary max (k)</span>
              <input
                type="number"
                value={draft.salary_max ?? ""}
                onChange={(e) => set("salary_max", ni(e.target.value))}
                placeholder="150"
              />
            </label>
            <label className="field">
              <span>Currency</span>
              <input
                value={draft.salary_currency ?? ""}
                onChange={(e) => set("salary_currency", e.target.value)}
                placeholder="USD"
              />
            </label>
            <label className="field">
              <span>Company size</span>
              <select
                value={draft.company_size ?? ""}
                onChange={(e) => set("company_size", e.target.value || null)}
              >
                <option value="">—</option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select
                style={{
                  color: draft.status ? STATUS_COLORS[draft.status] : "var(--text)",
                }}
                value={draft.status ?? ""}
                onChange={(e) =>
                  set("status", (e.target.value || null) as AppStatus | null)
                }
              >
                <option value="">—</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s} style={{ color: STATUS_COLORS[s] }}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>OA / HireVue</span>
              <select
                style={{ color: OA_COLORS[draft.oa_status] ?? "var(--muted)" }}
                value={draft.oa_status}
                onChange={(e) => set("oa_status", e.target.value as OaStatus)}
              >
                {OA_OPTIONS.map((s) => (
                  <option key={s} value={s} style={{ color: OA_COLORS[s] ?? "var(--muted)" }}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Interviews</span>
              <input
                type="number"
                min={0}
                value={draft.interviews}
                onChange={(e) => set("interviews", ni(e.target.value) ?? 0)}
              />
            </label>
          </div>

          <label className="field">
            <span>Job URL</span>
            <input
              value={draft.job_url ?? ""}
              onChange={(e) => set("job_url", e.target.value)}
              placeholder="https://…"
            />
          </label>

          {/* Application materials prepared */}
          <label className="field">
            <span>Extra info (materials prepared)</span>
            <MultiSelect
              options={EXTRA_INFO_OPTIONS}
              value={splitExtraInfo(draft.extra_info)}
              onChange={(next) => set("extra_info", joinExtraInfo(next))}
            />
          </label>

          <label className="field">
            <span>Job description</span>
            <textarea
              rows={8}
              value={draft.job_description ?? ""}
              onChange={(e) => set("job_description", e.target.value)}
            />
          </label>

          <label className="field">
            <span>Notes</span>
            <textarea
              rows={4}
              value={draft.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>

          <div className="detail-actions">
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || deleting}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving || deleting}
            >
              Close
            </button>
            <button
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
          </div>
        </>
      )}
    </aside>
  );
}
