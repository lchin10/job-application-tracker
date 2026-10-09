import { useEffect, useState, type FormEvent } from "react";
import type { Job } from "../types";
import { insertJob } from "../lib/jobs";
import { parseJob } from "../lib/parseJob";
import { todayISO } from "../lib/format";
import {
  COMPANY_SIZES,
  LOCATIONS,
  LOCATION_LABELS,
  LOCATION_COLORS,
  EXTRA_INFO,
  EXTRA_INFO_COLORS,
  joinExtraInfo,
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
  open: boolean;
  onClose: () => void;
  onCreated: (job: Job) => void;
}

const EMPTY = {
  company: "",
  role: "",
  salary_min: "",
  salary_max: "",
  salary_currency: "",
  company_size: "",
  job_url: "",
  job_description: "",
  // "More details" section
  date_applied: "",
  notes: "",
};

/** Empty -> null for nullable text columns. */
function nn(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function ni(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

type ParseMode = "link" | "text";

export default function AddJobModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [locations, setLocations] = useState<string[]>([]);
  const [extraInfo, setExtraInfo] = useState<string[]>([]);
  const [mode, setMode] = useState<ParseMode>("link");
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset everything each time the modal opens.
  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, date_applied: todayISO() });
      setLocations([]);
      setExtraInfo([]);
      setMode("link");
      setPasteText("");
      setError(null);
      setParseMsg(null);
      setBusy(false);
      setParsing(false);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleParse() {
    const url = form.job_url.trim();
    const text = pasteText.trim();
    if (mode === "link" && !url) {
      setParseMsg("Paste a job link first.");
      return;
    }
    if (mode === "text" && !text) {
      setParseMsg("Paste the job description text first.");
      return;
    }
    setParsing(true);
    setParseMsg(null);
    setError(null);
    try {
      const p = await parseJob(mode === "link" ? { url } : { text });
      // Parsed values only fill blanks; anything already typed wins.
      const parsedLoc = p.location ?? [];
      if (parsedLoc.length) setLocations((cur) => (cur.length ? cur : parsedLoc));
      // The model returns full annual figures; we store thousands.
      const toK = (n: number | null) =>
        n == null ? null : String(n >= 1000 ? Math.round(n / 1000) : n);
      const keep = (cur: string, next: string | null) => (cur.trim() ? cur : (next ?? ""));
      setForm((f) => ({
        ...f,
        company: keep(f.company, p.company),
        role: keep(f.role, p.role),
        company_size: keep(f.company_size, p.company_size),
        salary_min: keep(f.salary_min, toK(p.salary_min)),
        salary_max: keep(f.salary_max, toK(p.salary_max)),
        salary_currency: keep(f.salary_currency, p.salary_currency),
        job_description: keep(
          f.job_description,
          p.job_description ?? (mode === "text" ? text : null),
        ),
      }));
      const jd = p.job_description?.length ?? 0;
      setParseMsg(
        jd > 0
          ? `Parsed. Review the fields below (job description captured, ${jd} chars).`
          : "Parsed, but little content was found — fill in fields manually or paste the text.",
      );
    } catch (err) {
      setParseMsg(
        (err instanceof Error ? err.message : "Parse failed.") +
          " You can still fill in the fields manually.",
      );
    } finally {
      setParsing(false);
    }
  }

  // Enter in the form parses; only the Add button creates.
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!parsing && !busy) handleParse();
  }

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const created = await insertJob({
        company: form.company.trim(),
        role: form.role.trim(),
        location: locations.length ? locations : null,
        salary_min: ni(form.salary_min),
        salary_max: ni(form.salary_max),
        salary_currency: nn(form.salary_currency) ?? "USD",
        company_size: nn(form.company_size),
        job_url: nn(form.job_url),
        job_description: nn(form.job_description),
        date_applied: nn(form.date_applied) ?? todayISO(),
        extra_info: joinExtraInfo(extraInfo),
        notes: nn(form.notes),
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add job.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>Add application</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Parse section: paste a link, or paste text for sites that
              can't be scraped (LinkedIn, JS-heavy boards). */}
          <div className="parse-toggle">
            <button
              type="button"
              className={mode === "link" ? "seg is-active" : "seg"}
              onClick={() => {
                setMode("link");
                setParseMsg(null);
              }}
            >
              Paste link
            </button>
            <button
              type="button"
              className={mode === "text" ? "seg is-active" : "seg"}
              onClick={() => {
                setMode("text");
                setParseMsg(null);
              }}
            >
              Paste text
            </button>
          </div>

          {mode === "link" ? (
            <div className="parse-row">
              <label className="field parse-field">
                <span>Job link</span>
                <input
                  value={form.job_url}
                  onChange={(e) => set("job_url", e.target.value)}
                  placeholder="https://…  (paste a posting URL, then Parse)"
                  autoFocus
                />
              </label>
              <button
                type="button"
                className="btn"
                onClick={handleParse}
                disabled={parsing || busy}
              >
                {parsing ? "Parsing…" : "Parse"}
              </button>
            </div>
          ) : (
            <div className="parse-text">
              <label className="field">
                <span>Job description text</span>
                <textarea
                  rows={6}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="Paste the full job posting text here, then Parse."
                  autoFocus
                />
              </label>
              <button
                type="button"
                className="btn"
                onClick={handleParse}
                disabled={parsing || busy}
              >
                {parsing ? "Parsing…" : "Parse text"}
              </button>
            </div>
          )}
          {parseMsg && <p className="parse-msg muted">{parseMsg}</p>}

          <div className="divider" />

          {error && <p className="auth-error">{error}</p>}

          <div className="field-grid">
            <label className="field">
              <span>Company</span>
              <input value={form.company} onChange={(e) => set("company", e.target.value)} />
            </label>
            <label className="field">
              <span>Role</span>
              <input value={form.role} onChange={(e) => set("role", e.target.value)} />
            </label>
            <label className="field">
              <span>Location</span>
              <MultiSelect
                options={LOCATION_OPTIONS}
                value={locations}
                onChange={setLocations}
              />
            </label>
            <label className="field">
              <span>Company size</span>
              <select
                value={form.company_size}
                onChange={(e) => set("company_size", e.target.value)}
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
              <span>Salary min (k)</span>
              <input
                type="number"
                value={form.salary_min}
                onChange={(e) => set("salary_min", e.target.value)}
                placeholder="120"
              />
            </label>
            <label className="field">
              <span>Salary max (k)</span>
              <input
                type="number"
                value={form.salary_max}
                onChange={(e) => set("salary_max", e.target.value)}
                placeholder="150"
              />
            </label>
          </div>

          <details className="more-details">
            <summary>More details</summary>
            <div className="field-grid">
              <label className="field">
                <span>Date applied</span>
                <input
                  type="date"
                  value={form.date_applied}
                  onChange={(e) => set("date_applied", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Extra info (materials prepared)</span>
                <MultiSelect
                  options={EXTRA_INFO_OPTIONS}
                  value={extraInfo}
                  onChange={setExtraInfo}
                />
              </label>
            </div>
            <label className="field">
              <span>Job description</span>
              <textarea
                rows={6}
                value={form.job_description}
                onChange={(e) => set("job_description", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder={"Q: Question from the form\nTags: Why us\nYour answer…"}
              />
            </label>
          </details>

          <p className="muted modal-hint">
            Enter parses. Every field is editable in the panel after adding.
          </p>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={busy || parsing}
            >
              {busy ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
