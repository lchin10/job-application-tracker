import { useEffect, useMemo, useState } from "react";
import type { Job } from "../types";
import { parseQA } from "../lib/qa";
import { QA_TOPICS, QA_TYPES, QA_TAG_COLORS } from "../lib/constants";
import MultiSelect from "./MultiSelect";
import QAList from "./QAList";

const opts = (tags: readonly string[]) =>
  tags.map((t) => ({ value: t, label: t, color: QA_TAG_COLORS[t] }));
const TOPIC_OPTS = opts(QA_TOPICS);
const TYPE_OPTS = opts(QA_TYPES);

interface Props {
  open: boolean;
  onClose: () => void;
  jobs: Job[];
}

/** Every Q&A parsed from every job's notes, searchable and filterable by tag. */
export default function QABankModal({ open, onClose, jobs }: Props) {
  const [query, setQuery] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const all = useMemo(
    () =>
      jobs.flatMap((j) =>
        parseQA(j.notes).items.map((it, i) => ({
          ...it,
          id: `${j.id}:${i}`,
          label: j.company || j.role,
        })),
      ),
    [jobs],
  );

  // OR within a tag group, AND across groups and the text query.
  const q = query.trim().toLowerCase();
  const items = all.filter(
    (it) =>
      (!topics.length || topics.some((t) => it.tags.includes(t))) &&
      (!types.length || types.some((t) => it.tags.includes(t))) &&
      (!q || `${it.q}\n${it.a}\n${it.label}`.toLowerCase().includes(q)),
  );

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>Q&amp;A bank</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions, answers, companies…"
            autoFocus
          />
          <div className="filter-bar">
            <div className="filter-item">
              <span className="filter-label">Topic</span>
              <MultiSelect options={TOPIC_OPTS} value={topics} onChange={setTopics} placeholder="All" />
            </div>
            <div className="filter-item">
              <span className="filter-label">Type</span>
              <MultiSelect options={TYPE_OPTS} value={types} onChange={setTypes} placeholder="All" />
            </div>
            <span className="muted filter-clear">
              {items.length} / {all.length}
            </span>
          </div>
          {all.length === 0 ? (
            <p className="muted">
              No Q&amp;As yet. Start a line with <code>Q:</code> in any job's notes.
            </p>
          ) : (
            <QAList items={items} />
          )}
        </div>
      </div>
    </div>
  );
}
