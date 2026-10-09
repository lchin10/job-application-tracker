// One-off: reformat notes from the last 3 months into the Q:/Tags: format
// (see src/lib/qa.ts) using Claude.
//
//   node scripts/qa_backfill.ts          # call Claude, write scripts/out/qa_preview.md + qa_results.json
//   node scripts/qa_backfill.ts --apply  # back up current notes, write qa_results.json to the DB
//
// --apply makes no Claude calls: it writes exactly what you reviewed. Delete or
// edit entries in qa_results.json first to skip/adjust a job.
// Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / ANTHROPIC_API_KEY from .env.local.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { parseQA, formatQA, type QA } from "../src/lib/qa.ts";
import { QA_TAGS } from "../src/lib/constants.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "scripts", "out");
const RESULTS = join(OUT, "qa_results.json");
const APPLY = process.argv.includes("--apply");
const MONTHS = 3;

interface Result {
  id: string;
  company: string;
  old: string;
  new: string;
  inferred: string[]; // questions Claude wrote for answer-only notes
  edited: string[]; // answers that don't appear verbatim in the old notes
}

function loadEnv(): Record<string, string> {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function prompt(query: string, { hidden = false } = {}): Promise<string> {
  return new Promise((res) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    // @ts-expect-error private readline hook, used to hide the password
    rl._writeToOutput = (str: string) => {
      if (!muted) process.stdout.write(str);
    };
    rl.question(query, (ans) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      res(ans.trim());
    });
    if (hidden) muted = true;
  });
}

const SYSTEM = `You reformat a job applicant's personal notes for one application into question/answer pairs.

The notes usually hold answers the applicant wrote for questions on the application form. Common shapes:
- a question on one line, the answer on the following line(s), pairs separated by blank lines
- only an answer, with no question written down
- other remarks (referrals, reminders, contacts) that are not answers

Return:
- intro: every part of the notes that is not a question or an answer, copied verbatim. Empty string if none.
- items: one entry per answer.
  - q: the question exactly as written. If the notes only contain the answer, write the most likely
    application-form question it answers (short, phrased like a form question) and set inferred to true.
  - a: the answer copied verbatim. Do not edit, shorten, summarize, or fix typos.
  - tags: every tag that applies, from this list only:
    VideoNest, Celeri, AI Music Coach: the answer talks about that project.
    AI tooling/usage: the answer is about how the applicant uses AI tools.
    Why us: the question asks why this company / role.
    About me/summary: the question asks the applicant to introduce or summarize themselves.
    Difficult problem: the question asks about a hard problem, challenge, or failure.
    Customer facing: the question asks about working with customers, users, or stakeholders.
    AI: the question is about AI.

Do not drop any text from the notes. If the notes contain no answers at all, return an empty items list.`;

const SCHEMA = {
  type: "object",
  properties: {
    intro: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          q: { type: "string" },
          a: { type: "string" },
          inferred: { type: "boolean" },
          tags: { type: "array", items: { type: "string", enum: [...QA_TAGS] } },
        },
        required: ["q", "a", "inferred", "tags"],
        additionalProperties: false,
      },
    },
  },
  required: ["intro", "items"],
  additionalProperties: false,
};

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

async function reformat(
  client: Anthropic,
  job: { company: string; role: string; notes: string },
) {
  const res = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Company: ${job.company}\nRole: ${job.role}\n\n<notes>\n${job.notes}\n</notes>`,
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error(`refused (${res.stop_details?.category})`);
  if (res.stop_reason === "max_tokens") throw new Error("hit max_tokens");
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("no text in response");
  return JSON.parse(text.text) as { intro: string; items: (QA & { inferred: boolean })[] };
}

async function main() {
  const env = loadEnv();
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local");
  }
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const email = await prompt("Supabase email: ");
  const password = await prompt("Password: ", { hidden: true });
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) throw new Error(`Sign-in failed: ${authErr.message}`);

  // Page through: the API caps each response at max_rows (1000).
  const jobs: {
    id: string;
    company: string;
    role: string;
    date_applied: string | null;
    created_at: string;
    notes: string;
  }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("jobs")
      .select("id, company, role, date_applied, created_at, notes")
      .not("notes", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    jobs.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  if (APPLY) {
    const results: Result[] = JSON.parse(readFileSync(RESULTS, "utf8"));
    const current = new Map(jobs.map((j) => [j.id, j.notes]));
    writeFileSync(
      join(OUT, `notes_backup_${Date.now()}.json`),
      JSON.stringify(results.map((r) => ({ id: r.id, notes: current.get(r.id) ?? null })), null, 2),
    );
    console.log("Backed up current notes to scripts/out/.");
    if ((await prompt(`Update notes on ${results.length} jobs? (y/N): `)).toLowerCase() !== "y") {
      return console.log("Aborted. Nothing changed.");
    }
    for (const r of results) {
      if (current.get(r.id) !== r.old) {
        console.log(`skip ${r.company}: notes changed since preview`);
        continue;
      }
      const { error } = await supabase.from("jobs").update({ notes: r.new }).eq("id", r.id);
      console.log(error ? `FAIL ${r.company}: ${error.message}` : `ok   ${r.company}`);
    }
    return;
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MONTHS);
  const since = cutoff.toISOString().slice(0, 10);
  const todo = jobs.filter(
    (j) =>
      j.notes.trim() &&
      (j.date_applied ?? j.created_at.slice(0, 10)) >= since &&
      parseQA(j.notes).items.length === 0, // already in Q: format
  );
  console.log(`${todo.length} jobs with unformatted notes since ${since}.`);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const results: Result[] = [];
  for (const job of todo) {
    try {
      const out = await reformat(client, job);
      if (!out.items.length) {
        console.log(`none ${job.company}: no Q&As found`);
        continue;
      }
      const oldSquashed = squash(job.notes);
      results.push({
        id: job.id,
        company: job.company,
        old: job.notes,
        new: formatQA(out.intro, out.items.map(({ q, a, tags }) => ({ q, a, tags }))),
        inferred: out.items.filter((it) => it.inferred).map((it) => it.q),
        edited: out.items.filter((it) => !oldSquashed.includes(squash(it.a))).map((it) => it.q),
      });
      console.log(`ok   ${job.company}: ${out.items.length} Q&A`);
    } catch (err) {
      console.log(`FAIL ${job.company}: ${err instanceof Error ? err.message : err}`);
    }
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(RESULTS, JSON.stringify(results, null, 2));
  const md = results.map(
    (r) =>
      `## ${r.company}\n\n` +
      (r.inferred.length ? `**Inferred questions:** ${r.inferred.join(" | ")}\n\n` : "") +
      (r.edited.length ? `**⚠ Answer not verbatim:** ${r.edited.join(" | ")}\n\n` : "") +
      `### Old\n\n\`\`\`\n${r.old}\n\`\`\`\n\n### New\n\n\`\`\`\n${r.new}\n\`\`\`\n`,
  );
  writeFileSync(join(OUT, "qa_preview.md"), md.join("\n---\n\n"));
  console.log(`\nWrote ${results.length} results. Review scripts/out/qa_preview.md, then run with --apply.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
