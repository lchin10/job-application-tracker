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
- **Sorting & filtering** — sort by date applied or interviews; filter by location,
  company size, status, OA/HireVue, and prepared materials.
- **Summary stats** — totals, rejections, OAs completed, jobs interviewed for, and
  total interviews.
- **Color-coded** locations, statuses, and materials; multi-select locations and
  materials.
- **CSV import** for bulk-loading past applications from a Notion export.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Plain CSS with design tokens |
| Data & auth | Supabase (Postgres, Auth, Row Level Security) |
| AI parsing | Supabase Edge Function (Deno) + Google Gemini API |
| Hosting | GitHub Pages (static `dist/`) |

## Development

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (for AI parsing)

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

### Deploy

```bash
npm run deploy       # builds and publishes dist/ to the gh-pages branch
```

Then enable **Settings → Pages → Branch: `gh-pages`** in the GitHub repo.
