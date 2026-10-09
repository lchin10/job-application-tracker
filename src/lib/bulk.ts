import { COMPANY_SIZES } from "./constants.ts";
import type { Job } from "../types.ts";

// Parses a pasted table of applications (e.g. from a Claude chat) into rows to
// insert. Accepts tab-separated rows, a markdown table, or one cell per line
// (what copying a rendered table often gives). A header row sets column order.
// ponytail: one-cell-per-line can't see empty cells; use "—" for blanks there.

type Field = "company" | "role" | "salary" | "url" | "location" | "size";

const HEADERS: [RegExp, Field][] = [
  [/^(company size|size|employees)$/, "size"],
  [/^company$/, "company"],
  [/^(role|title|position|job title)$/, "role"],
  [/^(salary|salary range|comp|compensation|pay)$/, "salary"],
  [/^(job )?(listing )?(link|url)$/, "url"],
  [/^location$/, "location"],
];

const DEFAULT_ORDER: Field[] = ["company", "role", "salary", "url", "location", "size"];

const headerField = (cell: string) =>
  HEADERS.find(([re]) => re.test(cell.trim().toLowerCase()))?.[1];

function toRows(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const cells = (parts: string[]) => parts.map((c) => c.trim());
  if (lines.some((l) => l.includes("\t"))) return lines.map((l) => cells(l.split("\t")));
  if (lines.every((l) => l.trim().startsWith("|"))) {
    return lines
      .filter((l) => !/^\s*\|[\s:|-]+\|?\s*$/.test(l)) // separator row
      .map((l) => cells(l.trim().replace(/^\||\|$/g, "").split("|")));
  }
  // One cell per line: the header's length is the row width.
  let width = 0;
  while (width < lines.length && headerField(lines[width])) width++;
  width ||= DEFAULT_ORDER.length;
  const rows: string[][] = [];
  for (let i = 0; i < lines.length; i += width) rows.push(cells(lines.slice(i, i + width)));
  return rows;
}

/** "$110K–$140K + equity" -> [110, 140] (thousands). One figure fills both. */
export function parseSalary(s: string): [number | null, number | null] {
  const nums = [...s.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*([km])?/gi)].map(([, n, unit]) => {
    const v = parseFloat(n.replace(/,/g, ""));
    if (unit?.toLowerCase() === "k") return Math.round(v);
    if (unit?.toLowerCase() === "m") return Math.round(v * 1000);
    return Math.round(v >= 1000 ? v / 1000 : v);
  });
  if (!nums.length) return [null, null];
  return [nums[0], nums[1] ?? nums[0]];
}

const LOCATION_PATTERNS: [string, RegExp][] = [
  ["remote", /remote/],
  ["nyc", /\bnyc\b|new york|brooklyn|manhattan/],
  ["sf", /\bsf\b|san francisco|bay area/],
  ["seattle", /seattle/],
  ["boston", /boston/],
  ["la", /\bla\b|los angeles/],
  ["chicago", /chicago/],
  ["dc", /\bdc\b|washington,? d\.?c/],
];

/** "NYC (hybrid)" -> ["nyc"]. Unknown places are dropped. */
export function parseLocation(s: string): string[] | null {
  const lower = s.toLowerCase();
  const out = LOCATION_PATTERNS.filter(([, re]) => re.test(lower)).map(([v]) => v);
  return out.length ? out : null;
}

/** "10,000+" -> "10000+"; anything not a known bucket -> null. */
export function parseSize(s: string): string | null {
  const v = s.replace(/[,\s]|employees/gi, "");
  return (COMPANY_SIZES as readonly string[]).includes(v) ? v : null;
}

export function parseBulk(text: string): Partial<Job>[] {
  const rows = toRows(text);
  const header = rows[0]?.map(headerField);
  const hasHeader = !!header?.includes("company");
  const order = hasHeader ? header! : DEFAULT_ORDER;

  return rows.slice(hasHeader ? 1 : 0).flatMap((row) => {
    const get = (f: Field) => {
      const v = row[order.indexOf(f)]?.trim() ?? "";
      return /^[—–-]$/.test(v) ? "" : v;
    };
    const company = get("company");
    const role = get("role");
    if (!company && !role) return [];
    const [salary_min, salary_max] = parseSalary(get("salary"));
    return [
      {
        company,
        role,
        salary_min,
        salary_max,
        salary_currency: "USD",
        job_url: get("url").match(/https?:\/\/\S+/)?.[0] ?? null,
        location: parseLocation(get("location")),
        company_size: parseSize(get("size")),
      },
    ];
  });
}
