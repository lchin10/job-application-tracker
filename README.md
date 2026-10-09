# Job Application Tracker

A single-page app for tracking job applications. Add a role by pasting a job
link (or its text) and an AI step fills in the company, title, location, salary,
and company size for you — then you manage everything from a dense, sortable
table with a slide-out detail panel for notes and per-application materials.
Your data and login live in Supabase, secured per-user, so it syncs across
devices.

**Live:** https://lchin10.github.io/job-application-tracker/

## Features

- **Email/password auth** with per-user data isolation (Postgres Row Level Security).
- **AI link parsing** — paste a posting URL or text; a serverless function fetches
  it and uses Gemini to extract structured fields.
- **Dense table** with a pinned header, inline quick-edits (status, OA/HireVue,
  interview count), and a slide-out detail panel that scrolls independently.
- **Add with optional details** — the add modal parses on Enter, never overwrites a
  field you already typed, and has a collapsible "More details" section for date
  applied, prepared materials, job description, and notes.
- **Bulk add** — paste a table of applications (company, role, salary range, job link,
  location, company size), preview the parsed rows, and add them all at once.
  Applications you already track are skipped, and the table's row order is kept.
- **Search** — filter the table by company, role, or notes.
- **Sorting & filtering** — sort by date applied (oldest first, newest at the bottom,
  ties broken by time added) or interviews; filter by location, company size, status,
  OA/HireVue, and prepared materials.
- **Pinning** — pin the applications you care about to the top of the table, whatever
  the active sort.
- **Notes Q&A** — application-form answers written in notes show as collapsible
  questions, each with optional tags (see [Notes Q&A format](#notes-qa-format)).
- **Q&A bank** — every Q&A from every application in one place, searchable and
  filterable by topic and question type, labeled by company.
- **Keyboard shortcuts** — customizable from the Shortcuts menu (see
  [Keyboard shortcuts](#keyboard-shortcuts)).
- **Summary stats** — totals, rejections, OAs completed, jobs interviewed for, and
  total interviews.
- **Color-coded** locations, statuses, and materials; multi-select locations and
  materials.
- **CSV import** for bulk-loading past applications from a Notion export.
- **Claude notes backfill** — a one-off script that converts older free-form notes
  into the Q&A format.

## Keyboard shortcuts

Defaults below. Change them from the **Shortcuts** button in the header; bindings
are saved in your browser. Shortcuts are ignored while typing in a field or while a
dialog is open.

| Action | Default |
|---|---|
| Add application | `n` |
| Bulk add applications | `m` |
| Go to top | `Ctrl + ↑` |
| Go to bottom | `Ctrl + ↓` |
| Focus search | `s` |

Dialogs close with **Esc** or the **✕** button; clicking outside a dialog does not
close it.

## Notes Q&A format

A line starting with `Q:` begins a question. An optional `Tags:` line directly
under it holds comma-separated tags. Everything after that, up to the next `Q:`
line, is the answer (an `A:` prefix is optional). Text before the first `Q:` is
shown as-is.

```text
Referred by Sam.

Q: Why do you want to work here?
Tags: Why us
I love the product...

Q: Describe a difficult problem you solved.
Tags: Difficult problem, Celeri
At Celeri I...
```

After saving, the job panel shows these as collapsible questions; click **Edit**
to get the raw text back. Tags can also be picked from a dropdown inside each
question (saved with the normal **Save** button).

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Plain CSS with design tokens |
| Data & auth | Supabase (Postgres, Auth, Row Level Security) |
| AI parsing | Supabase Edge Function (Deno) + Google Gemini API |
| Notes backfill | Local Node script + Claude API (`@anthropic-ai/sdk`) |
| Hosting | GitHub Pages (static `dist/`) |

## Development

### Prerequisites
- Node.js 18+ (22.18+ to run the `.ts` scripts in `scripts/`)
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (for AI parsing)
- An [Anthropic](https://console.anthropic.com) API key (optional, only for the notes backfill)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (Supabase -> Settings -> API)
cp .env.example .env.local
# then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# 3. Create the database
# In the Supabase SQL Editor, run supabase/schema.sql,
# then any files in supabase/migrations/ in order.

# 4. Run locally
npm run dev          # http://localhost:5173/job-application-tracker/
```

### Edge function (AI parsing)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase secrets set GEMINI_API_KEY=<your-gemini-key>
npx supabase functions deploy parse-job
```

### Bulk import (optional)

```bash
# Imports a Notion CSV export under your account (prompts for email/password).
npm run import:csv            # add --dry to preview without inserting
```

### Notes backfill with Claude (optional)

Converts notes from the last 3 months that aren't in the Q&A format yet. Claude
splits them into questions and answers (copying answers word for word), writes a
likely question for answer-only notes, and picks tags. Add `ANTHROPIC_API_KEY` to
`.env.local` first (no `VITE_` prefix, so it never ships to the browser).

```bash
npm run qa:backfill             # calls Claude; writes scripts/out/qa_preview.md to review
npm run qa:backfill -- --apply  # backs up current notes, then writes the reviewed results
```

`--apply` makes no new Claude calls and skips any job whose notes changed since the
preview. Output lives in `scripts/out/` (gitignored).

### Self-checks

```bash
node scripts/qa.check.ts     # notes Q&A parser
node scripts/bulk.check.ts   # bulk-add table parser
```

### Deploy

```bash
npm run deploy       # builds and publishes dist/ to the gh-pages branch
```

Then enable **Settings → Pages → Branch: `gh-pages`** in the GitHub repo.
