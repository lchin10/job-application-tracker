import type { CSSProperties } from "react";
import type { QA } from "../lib/qa";
import { QA_TAGS, QA_TAG_COLORS } from "../lib/constants";
import MultiSelect from "./MultiSelect";

const TAG_OPTIONS = QA_TAGS.map((t) => ({ value: t, label: t, color: QA_TAG_COLORS[t] }));

interface Props {
  items: (QA & { id?: string; label?: string })[];
  /** When given, each open item shows a tag picker. */
  onTagsChange?: (index: number, tags: string[]) => void;
}

/** Questions as native disclosure rows; click a question to reveal the answer. */
export default function QAList({ items, onTagsChange }: Props) {
  return (
    <div className="qa-list">
      {items.map((it, i) => (
        <details key={it.id ?? i} className="qa-item">
          <summary>
            <span className="qa-q">{it.q || "(no question)"}</span>
            <span className="tag-list">
              {it.label && <span className="chip chip-plain">{it.label}</span>}
              {it.tags.map((t) => (
                <span
                  key={t}
                  className="chip"
                  style={{ "--c": QA_TAG_COLORS[t] } as CSSProperties}
                >
                  {t}
                </span>
              ))}
            </span>
          </summary>
          <div className="qa-a">{it.a || <span className="muted">(no answer)</span>}</div>
          {onTagsChange && (
            <MultiSelect
              options={TAG_OPTIONS}
              value={it.tags}
              onChange={(next) => onTagsChange(i, next)}
              placeholder="Add tags…"
            />
          )}
        </details>
      ))}
    </div>
  );
}
