import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Job } from "../types";
import JobRow from "./JobRow";

export type SortKey = "date_applied" | "interviews";

interface Props {
  jobs: Job[];
  activeId: string | null;
  onSelect: (job: Job) => void;
  onQuickUpdate: (id: string, patch: Partial<Job>) => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}

const COLUMNS: { label: string; sortKey?: SortKey; className?: string }[] = [
  { label: "", className: "pin-col" }, // pin toggle
  { label: "Company" },
  { label: "Role" },
  { label: "Date Applied", sortKey: "date_applied" },
  { label: "Location" },
  { label: "Salary" },
  { label: "Company Size" },
  { label: "Extra Info" },
  { label: "Status" },
  { label: "OA/HireVue" },
  { label: "Interviews", sortKey: "interviews" },
];

export default function JobsTable({
  jobs,
  activeId,
  onSelect,
  onQuickUpdate,
  sortKey,
  sortDir,
  onSort,
}: Props) {
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const rowEls = useRef(new Map<string, HTMLTableRowElement>());
  // Sticky offset per pinned row: the header height plus the pinned rows above it.
  const [stickyTops, setStickyTops] = useState<Record<string, number>>({});

  // `jobs` arrives pinned-first, so this is already in display order.
  const pinnedIds = jobs.filter((j) => j.pinned).map((j) => j.id);
  const pinnedKey = pinnedIds.join(",");

  const measure = useCallback(() => {
    let acc = theadRef.current?.getBoundingClientRect().height ?? 0;
    const next: Record<string, number> = {};
    for (const id of pinnedIds) {
      // Floor so rows overlap by a sub-pixel rather than leaving a seam.
      next[id] = Math.floor(acc);
      acc += rowEls.current.get(id)?.getBoundingClientRect().height ?? 0;
    }
    setStickyTops((prev) => {
      const same =
        Object.keys(prev).length === Object.keys(next).length &&
        Object.keys(next).every((id) => prev[id] === next[id]);
      return same ? prev : next;
    });
    // pinnedIds is derived from pinnedKey; re-run when that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedKey]);

  // Re-measure whenever the pinned set changes or any measured element resizes
  // (window width, chips wrapping to a second line, …).
  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (theadRef.current) ro.observe(theadRef.current);
    for (const id of pinnedIds) {
      const el = rowEls.current.get(id);
      if (el) ro.observe(el);
    }
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, pinnedKey]);

  const setRowEl = useCallback((id: string, el: HTMLTableRowElement | null) => {
    if (el) rowEls.current.set(id, el);
    else rowEls.current.delete(id);
  }, []);

  return (
    <table className="jobs-table">
      <thead ref={theadRef}>
        <tr>
          {COLUMNS.map((col) => {
            const active = col.sortKey === sortKey;
            const className = [col.className, col.sortKey ? "sortable" : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <th
                key={col.label || col.className}
                className={className || undefined}
                onClick={col.sortKey ? () => onSort(col.sortKey!) : undefined}
              >
                {col.label}
                {col.sortKey && (
                  <span className={active ? "sort-arrow active" : "sort-arrow"}>
                    {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                  </span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            active={job.id === activeId}
            onSelect={onSelect}
            onQuickUpdate={onQuickUpdate}
            rowRef={job.pinned ? setRowEl : undefined}
            stickyTop={job.pinned ? stickyTops[job.id] : undefined}
          />
        ))}
      </tbody>
    </table>
  );
}
