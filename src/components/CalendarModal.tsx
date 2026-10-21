import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Job } from "../types";
import { todayISO } from "../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  jobs: Job[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Month grid with the number of applications sent each day. */
export default function CalendarModal({ open, onClose, jobs }: Props) {
  const today = todayISO();
  const [month, setMonth] = useState(() => today.slice(0, 7)); // yyyy-mm

  useEffect(() => {
    if (open) setMonth(todayISO().slice(0, 7));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) if (j.date_applied) m.set(j.date_applied, (m.get(j.date_applied) ?? 0) + 1);
    return m;
  }, [jobs]);

  if (!open) return null;

  const [y, mo] = month.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`);
  const monthTotal = days.reduce((sum, d) => sum + (counts.get(d) ?? 0), 0);
  const max = Math.max(1, ...days.map((d) => counts.get(d) ?? 0));
  const shift = (delta: number) => {
    const d = new Date(y, mo - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>Applications calendar</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="cal-nav">
            <button className="btn btn-ghost" onClick={() => shift(-1)} aria-label="Previous month">
              ‹
            </button>
            <strong>
              {first.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </strong>
            <button className="btn btn-ghost" onClick={() => shift(1)} aria-label="Next month">
              ›
            </button>
            <span className="muted cal-total">
              {monthTotal} application{monthTotal === 1 ? "" : "s"}
            </span>
          </div>
          <div className="cal-grid">
            {WEEKDAYS.map((w) => (
              <span key={w} className="cal-weekday">
                {w}
              </span>
            ))}
            {Array.from({ length: first.getDay() }, (_, i) => (
              <span key={`pad${i}`} />
            ))}
            {days.map((d) => {
              const n = counts.get(d) ?? 0;
              return (
                <div
                  key={d}
                  className={d === today ? "cal-day is-today" : "cal-day"}
                  style={{ "--heat": n ? 0.15 + 0.6 * (n / max) : 0 } as CSSProperties}
                  title={`${d}: ${n} application${n === 1 ? "" : "s"}`}
                >
                  <span className="cal-date">{Number(d.slice(8))}</span>
                  {n > 0 && <span className="cal-count">{n}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
