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
  /** Registers the <tr> so JobsTable can measure it (pinned rows only). */
  rowRef?: (id: string, el: HTMLTableRowElement | null) => void;
  /** Offset below the sticky header, in px. Set for pinned rows once measured. */
  stickyTop?: number;
}

const OA_OPTIONS: OaStatus[] = ["none", "pending", "submitted", "dropped"];

/** CSS custom property for chip color. */
const cv = (c?: string): CSSProperties => (c ? ({ "--c": c } as CSSProperties) : {});

export default function JobRow({
  job,
  active,
  onSelect,
  onQuickUpdate,
  rowRef,
  stickyTop,
}: Props) {
  const salary = formatSalary(job);

  // Stop row-select from firing when interacting with inline controls.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // Pinned rows stick under the table header; the offset is measured by
  // JobsTable and handed down, since row heights vary.
  const sticky = job.pinned && stickyTop != null;

  const rowClass = [
    "job-row",
    active ? "is-active" : "",
    job.pinned ? "is-pinned" : "",
    sticky ? "is-sticky" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <tr
      className={rowClass}
      ref={rowRef ? (el) => rowRef(job.id, el) : undefined}
      style={sticky ? ({ "--sticky-top": `${stickyTop}px` } as CSSProperties) : undefined}
      onClick={() => onSelect(job)}
    >
      <td className="pin-cell" onClick={stop}>
        <button
          type="button"
          className={job.pinned ? "pin-btn is-pinned" : "pin-btn"}
          aria-label={job.pinned ? "Unpin application" : "Pin application"}
          aria-pressed={job.pinned}
          title={job.pinned ? "Unpin" : "Pin to top"}
          onClick={() => onQuickUpdate(job.id, { pinned: !job.pinned })}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
          </svg>
        </button>
      </td>
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
