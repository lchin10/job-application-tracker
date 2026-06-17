import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import type { Job } from "./types";
import { listJobs, updateJob } from "./lib/jobs";
import { splitExtraInfo } from "./lib/constants";
import Auth from "./components/Auth";
import JobsTable, { type SortKey } from "./components/JobsTable";
import DetailPanel from "./components/DetailPanel";
import AddJobModal from "./components/AddJobModal";
import ScrollFab from "./components/ScrollFab";
import FilterBar, {
  type Filters,
  EMPTY_FILTERS,
  NONE,
} from "./components/FilterBar";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="centered muted">
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return <Tracker session={session} />;
}

function Tracker({ session }: { session: Session }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("date_applied");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const paneRef = useRef<HTMLDivElement>(null);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setError(null);
    try {
      setJobs(await listJobs());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs.");
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const activeJob = jobs.find((j) => j.id === activeId) ?? null;

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Date defaults ascending; interviews defaults descending (most first).
      setSortDir(key === "interviews" ? "desc" : "asc");
    }
  }

  // Filter then sort, client-side over the loaded rows.
  const visibleJobs = useMemo(() => {
    const matches = (job: Job) => {
      if (filters.location.length) {
        const locs = job.location ?? [];
        const ok = filters.location.some((f) =>
          f === NONE ? locs.length === 0 : locs.includes(f),
        );
        if (!ok) return false;
      }
      if (filters.company_size.length) {
        const ok = filters.company_size.some((f) =>
          f === NONE ? job.company_size == null : job.company_size === f,
        );
        if (!ok) return false;
      }
      if (filters.status.length) {
        const ok = filters.status.some((f) =>
          f === NONE ? job.status == null : job.status === f,
        );
        if (!ok) return false;
      }
      if (filters.oa_status.length && !filters.oa_status.includes(job.oa_status)) {
        return false;
      }
      if (filters.extra_info.length) {
        const items = splitExtraInfo(job.extra_info);
        const ok = filters.extra_info.some((f) =>
          f === NONE ? items.length === 0 : items.includes(f),
        );
        if (!ok) return false;
      }
      return true;
    };

    const out = jobs.filter(matches);
    out.sort((a, b) => {
      let cmp: number;
      if (sortKey === "interviews") {
        cmp = a.interviews - b.interviews;
      } else {
        // yyyy-mm-dd strings compare lexicographically; nulls sort last.
        const av = a.date_applied ?? "9999-99-99";
        const bv = b.date_applied ?? "9999-99-99";
        cmp = av < bv ? -1 : av > bv ? 1 : 0;
      }
      // Tiebreak by created_at ascending, so a newly added job (same date)
      // lands at the bottom of its group.
      if (cmp === 0) {
        cmp = a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [jobs, filters, sortKey, sortDir]);

  const filtersActive =
    filters.location.length +
      filters.company_size.length +
      filters.status.length +
      filters.oa_status.length +
      filters.extra_info.length >
    0;

  // Summary stats over all applications.
  const stats = useMemo(() => {
    let rejected = 0;
    let oaCompleted = 0;
    let interviewedJobs = 0;
    let totalInterviews = 0;
    for (const j of jobs) {
      if (j.status === "rejected") rejected++;
      if (j.oa_status === "submitted") oaCompleted++;
      if (j.interviews > 0) interviewedJobs++;
      totalInterviews += j.interviews ?? 0;
    }
    return { rejected, oaCompleted, interviewedJobs, totalInterviews };
  }, [jobs]);

  function handleSaved(updated: Job) {
    setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
  }

  function handleDeleted(id: string) {
    setJobs((prev) => prev.filter((j) => j.id !== id));
    if (activeId === id) setActiveId(null);
  }

  // Add the new row and open it. Snap to date-applied ascending so it lands at
  // the bottom (today's date + newest created_at tiebreak).
  function handleCreated(job: Job) {
    setJobs((prev) => [...prev, job]);
    setActiveId(job.id);
    setAddOpen(false);
    setSortKey("date_applied");
    setSortDir("asc");
  }

  // Inline quick-edit: update optimistically, persist, revert by reload on error.
  async function handleQuickUpdate(id: string, patch: Partial<Job>) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
    try {
      await updateJob(id, patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
      loadJobs();
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          <h1>Job Application Tracker</h1>
          {!loadingJobs && jobs.length > 0 && (
            <span className="job-count">
              {filtersActive ? `${visibleJobs.length} / ${jobs.length}` : jobs.length}
            </span>
          )}
        </div>
        <div className="header-right">
          <span className="muted user-email">{session.user.email}</span>
          <button
            className="btn btn-ghost"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      {!loadingJobs && jobs.length > 0 && (
        <div className="stats-bar">
          <div className="stat-card">
            <span className="stat-num">{jobs.length}</span>
            <span className="stat-label">Total applications</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-card">
            <span className="stat-num">{stats.rejected}</span>
            <span className="stat-label">Rejected</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{stats.oaCompleted}</span>
            <span className="stat-label">OAs / HireVues completed</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{stats.interviewedJobs}</span>
            <span className="stat-label">Jobs interviewed for</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{stats.totalInterviews}</span>
            <span className="stat-label">Total interviews</span>
          </div>
        </div>
      )}

      <main className={activeJob ? "content-split panel-open" : "content-split"}>
        <div className="table-pane" ref={paneRef}>
          {error && <p className="auth-error">{error}</p>}

          {loadingJobs ? (
            <p className="muted">Loading jobs…</p>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <p className="muted">No applications yet.</p>
              <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
                + Add your first application
              </button>
            </div>
          ) : (
            <>
              <div className="table-toolbar">
                <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
                  + Add application
                </button>
              </div>

              <FilterBar filters={filters} onChange={setFilters} />

              {visibleJobs.length === 0 ? (
                <div className="empty-state">
                  <p className="muted">No applications match these filters.</p>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <JobsTable
                  jobs={visibleJobs}
                  activeId={activeId}
                  onSelect={(j) => setActiveId(j.id)}
                  onQuickUpdate={handleQuickUpdate}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              )}

              <div className="table-toolbar table-toolbar-bottom">
                <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
                  + Add application
                </button>
              </div>
            </>
          )}
        </div>
        <DetailPanel
          job={activeJob}
          onClose={() => setActiveId(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      </main>

      <AddJobModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={handleCreated}
      />
      <ScrollFab targetRef={paneRef} panelOpen={!!activeJob} />
    </div>
  );
}
