import type { CSSProperties } from "react";
import type { Job, OaStatus } from "../types";
import { formatSalary, formatDate } from "../lib/format";
import {
  locationLabel,
  splitExtraInfo,
  STATUSES,
  STATUS_COLORS,
  OA_COLORS,
  LOCATION_COLORS,
  EXTRA_INFO_COLORS,
  type AppStatus,
} from "../lib/constants";

interface Props {
  job: Job;
  active: boolean;
  onSelect: (job: Job) => void;
  onQuickUpdate: (id: string, patch: Partial<Job>) => void;
}

const OA_OPTIONS: OaStatus[] = ["none", "pending", "submitted", "dropped"];

/** CSS custom property for chip color. */
const cv = (c?: string): CSSProperties => (c ? ({ "--c": c } as CSSProperties) : {});

export default function JobRow({ job, active, onSelect, onQuickUpdate }: Props) {
  const salary = formatSalary(job);

  // Stop row-select from firing when interacting with inline controls.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <tr
      className={active ? "job-row is-active" : "job-row"}
      onClick={() => onSelect(job)}
    >
      <td>
        <span className="company-cell">
          {job.notes && (
            <span className="note-icon" title="Has notes" aria-label="Has notes">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 5h16v2H4zM4 11h16v2H4zM4 17h10v2H4z" />
              </svg>
            </span>
          )}
          {job.company || <span className="muted">—</span>}
        </span>
      </td>
      <td>{job.role || <span className="muted">—</span>}</td>
      <td className="num">{formatDate(job.date_applied) || <span className="muted">—</span>}</td>
      <td>
        {job.location && job.location.length ? (
          <div className="tag-list">
            {job.location.map((loc) => (
              <span key={loc} className="chip" style={cv(LOCATION_COLORS[loc])}>
                {locationLabel(loc)}
              </span>
            ))}
          </div>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td className="num">{salary || <span className="muted">—</span>}</td>
      <td>{job.company_size || <span className="muted">—</span>}</td>
      <td className="extra-cell">
        {job.extra_info ? (
          <div className="tag-list">
            {splitExtraInfo(job.extra_info).map((t) => (
              <span key={t} className="chip" style={cv(EXTRA_INFO_COLORS[t])}>
                {t}
              </span>
            ))}
          </div>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td onClick={stop}>
        <select
          className="inline-status"
          style={{ color: job.status ? STATUS_COLORS[job.status] : "var(--muted)" }}
          value={job.status ?? ""}
          onChange={(e) =>
            onQuickUpdate(job.id, {
              status: (e.target.value || null) as AppStatus | null,
            })
          }
        >
          <option value="">—</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} style={{ color: STATUS_COLORS[s] }}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td onClick={stop}>
        <select
          className="inline-status"
          style={{ color: OA_COLORS[job.oa_status] ?? "var(--muted)" }}
          value={job.oa_status}
          onChange={(e) => onQuickUpdate(job.id, { oa_status: e.target.value as OaStatus })}
        >
          {OA_OPTIONS.map((s) => (
            <option key={s} value={s} style={{ color: OA_COLORS[s] ?? "var(--muted)" }}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="num" onClick={stop}>
        <div className="stepper">
          <button
            type="button"
            className="step-btn"
            aria-label="Decrease interviews"
            disabled={job.interviews <= 0}
            onClick={() => onQuickUpdate(job.id, { interviews: Math.max(0, job.interviews - 1) })}
          >
            −
          </button>
          <span className="step-count">{job.interviews}</span>
          <button
            type="button"
            className="step-btn"
            aria-label="Increase interviews"
            onClick={() => onQuickUpdate(job.id, { interviews: job.interviews + 1 })}
          >
            +
          </button>
        </div>
      </td>
    </tr>
  );
}
