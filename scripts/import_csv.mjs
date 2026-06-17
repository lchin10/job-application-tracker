// One-off importer: reads a Notion CSV export of job applications, signs in
// with your Supabase email/password, and bulk-inserts the rows under your user
// (RLS sets user_id automatically).
//
//   node scripts/import_csv.mjs [path-to-csv]
//
// Defaults to ./from_notion.csv. Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// from .env.local. Run the DB migrations first (location -> text[], add status).

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const pathArg = args.find((a) => !a.startsWith("--"));
const CSV_PATH = resolve(pathArg ?? join(ROOT, "from_notion.csv"));
const BATCH = 200;

function loadEnv() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

// ---------------------------------------------------------------------------
// CSV parsing (RFC-4180-ish: quotes, "" escapes, commas/newlines in fields)
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, ""); // strip BOM

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore; \n handles the row break
    } else {
      field += c;
    }
  }
  // trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const norm = (h) => h.trim().replace(/\s+/g, " ").toLowerCase();

// ---------------------------------------------------------------------------
// Field mappers
// ---------------------------------------------------------------------------
const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function parseDate(str) {
  if (!str) return null;
  const m = str.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}`;
}

const LOC_MAP = {
  nyc: "nyc", sf: "sf", seattle: "seattle", boston: "boston",
  la: "la", chicago: "chicago", dc: "dc", remote: "remote",
};

function parseLocations(str) {
  if (!str) return null;
  const arr = [
    ...new Set(
      str.split(",").map((x) => LOC_MAP[x.trim().toLowerCase()]).filter(Boolean),
    ),
  ];
  return arr.length ? arr : null;
}

const SIZE_MAP = {
  "1-10": "1-10",
  "11-50": "11-50",
  "51-200": "51-200",
  "201-500": "201-500",
  "501-1k": "501-1000",
  "501-1000": "501-1000",
  "1k-5k": "1001-5000",
  "1001-5000": "1001-5000",
  "5k-10k": "5001-10000",
  "5001-10000": "5001-10000",
  "10k+": "10000+",
  "10000+": "10000+",
};

function parseCompanySize(str) {
  if (!str) return null;
  return SIZE_MAP[str.trim().toLowerCase()] ?? null;
}

// Returns salary in THOUSANDS: "120k" -> 120, "100000" -> 100.
function parseMoney(part) {
  const k = part.match(/([\d,.]+)\s*k/i);
  if (k) return Math.round(parseFloat(k[1].replace(/,/g, "")));
  const d = part.match(/([\d,.]+)/);
  if (d) {
    const n = parseFloat(d[1].replace(/,/g, ""));
    return Math.round(n >= 1000 ? n / 1000 : n);
  }
  return null;
}

function parseSalary(str) {
  if (!str) return [null, null];
  const nums = str.split("-").map((p) => parseMoney(p.trim())).filter((n) => n != null);
  if (nums.length === 0) return [null, null];
  if (nums.length === 1) return [nums[0], nums[0]]; // single figure -> both
  return [nums[0], nums[1]];
}

const EXTRA_MAP = {
  "cover letter": "Cover letter",
  "why us": "Why us",
  "project/technical": "Project/Technical",
  "about me": "About me",
  "follow-up email": "Follow-up email",
  "follow up email": "Follow-up email",
  other: "Other",
};

// CSV "Extra Info" -> comma-joined canonical labels for the extra_info column.
function parseExtraInfo(str) {
  if (!str) return null;
  const arr = [
    ...new Set(str.split(",").map((t) => EXTRA_MAP[t.trim().toLowerCase()]).filter(Boolean)),
  ];
  return arr.length ? arr.join(", ") : null;
}

const OA_MAP = { submitted: "submitted", dropped: "dropped", pending: "pending" };
function parseOa(str) {
  return OA_MAP[(str ?? "").trim().toLowerCase()] ?? "none";
}

const STATUS_SET = new Set([
  "rejected", "ghosted", "pending", "interviewing", "offer", "dropped", "oa",
]);
function parseStatus(str) {
  const v = (str ?? "").trim().toLowerCase();
  return STATUS_SET.has(v) ? v : null;
}

function parseInterviews(str) {
  const n = parseInt((str ?? "").trim(), 10);
  return Number.isNaN(n) ? 0 : n;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
function prompt(query, { hidden = false } = {}) {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (str) => {
      if (!muted) rl.output.write(str);
    };
    rl.question(query, (ans) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      res(ans.trim());
    });
    if (hidden) muted = true;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const csvText = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    console.error("CSV has no data rows.");
    process.exit(1);
  }

  const headers = rows[0].map(norm);
  const idx = (name) => headers.indexOf(name);
  const col = {
    company: idx("company"),
    companySize: idx("company size"),
    date: idx("date applied"),
    extra: idx("extra info"),
    interviews: idx("interviews"),
    location: idx("location"),
    notes: idx("notes"),
    oa: idx("oa/hirevue"),
    role: idx("role"),
    salary: idx("salary"),
    status: idx("status"),
  };

  const jobs = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 1 && row[0].trim() === "") continue; // blank line
    const get = (i) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const [salaryMin, salaryMax] = parseSalary(get(col.salary));

    jobs.push({
      company: get(col.company),
      role: get(col.role),
      date_applied: parseDate(get(col.date)),
      location: parseLocations(get(col.location)),
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: "USD",
      company_size: parseCompanySize(get(col.companySize)),
      status: parseStatus(get(col.status)),
      oa_status: parseOa(get(col.oa)),
      interviews: parseInterviews(get(col.interviews)),
      extra_info: parseExtraInfo(get(col.extra)),
      notes: get(col.notes) || null,
    });
  }

  console.log(`Parsed ${jobs.length} rows from ${CSV_PATH}`);

  // Report distributions + anything that didn't map cleanly, for validation.
  const tally = (fn) => {
    const m = {};
    for (let r = 1; r < rows.length; r++) {
      const v = fn(rows[r]) ?? "(empty)";
      m[v] = (m[v] ?? 0) + 1;
    }
    return m;
  };
  const getRaw = (i) => (row) => (i >= 0 ? (row[i] ?? "").trim() : "");
  console.log("\nStatus:", tally((r) => parseStatus(getRaw(col.status)(r)) ?? "(empty)"));
  console.log("OA:", tally((r) => parseOa(getRaw(col.oa)(r))));
  const unmappedSizes = new Set();
  const unmappedLocs = new Set();
  const badDates = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 1 && row[0].trim() === "") continue;
    const cs = getRaw(col.companySize)(row);
    if (cs && !parseCompanySize(cs)) unmappedSizes.add(cs);
    for (const tok of getRaw(col.location)(row).split(",")) {
      const t = tok.trim();
      if (t && !LOC_MAP[t.toLowerCase()]) unmappedLocs.add(t);
    }
    const d = getRaw(col.date)(row);
    if (d && !parseDate(d)) badDates.push(d);
  }
  console.log("Unmapped company sizes:", [...unmappedSizes]);
  console.log("Unmapped locations:", [...unmappedLocs]);
  console.log("Unparseable dates:", badDates);
  console.log("\nSample row:", JSON.stringify(jobs[0], null, 2));

  if (DRY) {
    console.log("\n--dry: parsed only, nothing inserted.");
    process.exit(0);
  }

  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local");
    process.exit(1);
  }

  const email = await prompt("Supabase email: ");
  const password = await prompt("Password: ", { hidden: true });

  const supabase = createClient(url, anon);
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error("Sign-in failed:", authErr.message);
    process.exit(1);
  }
  console.log("Signed in.");

  const go = await prompt(`Insert ${jobs.length} rows now? (y/N): `);
  if (go.toLowerCase() !== "y") {
    console.log("Aborted. Nothing inserted.");
    process.exit(0);
  }

  let inserted = 0;
  for (let i = 0; i < jobs.length; i += BATCH) {
    const chunk = jobs.slice(i, i + BATCH);
    const { error } = await supabase.from("jobs").insert(chunk);
    if (error) {
      console.error(`Batch starting at ${i} failed:`, error.message);
      process.exit(1);
    }
    inserted += chunk.length;
    console.log(`Inserted ${inserted}/${jobs.length}`);
  }

  console.log(`Done. Imported ${inserted} applications.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
