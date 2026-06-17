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

const COLUMNS: { label: string; sortKey?: SortKey }[] = [
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
  return (
    <table className="jobs-table">
      <thead>
        <tr>
          {COLUMNS.map((col) => {
            const active = col.sortKey === sortKey;
            return (
              <th
                key={col.label}
                className={col.sortKey ? "sortable" : undefined}
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
          />
        ))}
      </tbody>
    </table>
  );
}
