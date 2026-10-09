import { QA_TAGS, splitExtraInfo } from "./constants.ts";

// Notes Q&A format:
//   free text before the first question (kept as "intro")
//   Q: question text
//   Tags: VideoNest, Why us        <- optional, right under the Q: line
//   A: answer (the "A:" prefix is optional; answer runs until the next Q:)

export interface QA {
  q: string;
  a: string;
  tags: string[];
}

const Q_RE = /^\s*Q:\s*/i;
const TAGS_RE = /^\s*Tags:\s*/i;
const A_RE = /^\s*A:\s*/i;

/** Map a tag to its canonical spelling (case-insensitive); unknown tags kept as typed. */
function canonTag(t: string): string {
  return QA_TAGS.find((x) => x.toLowerCase() === t.toLowerCase()) ?? t;
}

export function parseQA(notes: string | null): { intro: string; items: QA[] } {
  const intro: string[] = [];
  const items: (QA & { lines: string[] })[] = [];

  for (const line of (notes ?? "").split(/\r?\n/)) {
    const cur = items[items.length - 1];
    if (Q_RE.test(line)) {
      items.push({ q: line.replace(Q_RE, "").trim(), a: "", tags: [], lines: [] });
    } else if (cur && cur.lines.length === 0 && cur.tags.length === 0 && TAGS_RE.test(line)) {
      cur.tags = [...new Set(splitExtraInfo(line.replace(TAGS_RE, "")).map(canonTag))];
    } else if (cur) {
      cur.lines.push(line);
    } else {
      intro.push(line);
    }
  }

  return {
    intro: intro.join("\n").trim(),
    items: items.map(({ q, tags, lines }) => ({
      q,
      tags,
      a: lines.join("\n").trim().replace(A_RE, ""),
    })),
  };
}

export function formatQA(intro: string, items: QA[]): string {
  const blocks = items.map(({ q, a, tags }) =>
    [`Q: ${q}`, tags.length ? `Tags: ${tags.join(", ")}` : "", a]
      .filter(Boolean)
      .join("\n"),
  );
  return [intro.trim(), ...blocks].filter(Boolean).join("\n\n");
}
