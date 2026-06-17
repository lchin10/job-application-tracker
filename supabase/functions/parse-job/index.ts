// Supabase Edge Function: parse-job
// Fetches a job posting URL server-side (no CORS limits, no exposed key) or
// accepts pasted text, then asks Gemini to extract structured fields.
//
// Deploy:  npx supabase functions deploy parse-job
// Secret:  npx supabase secrets set GEMINI_API_KEY=<your-key>

// The exact model id can change; confirm the current free "flash" id in
// Google AI Studio and update this if needed.
const MODEL = "gemini-2.5-flash";
const GEMINI_URL = (m: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

// Only these origins may call the function from a browser. Add any future
// custom domain here.
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://lchin10.github.io",
];

/** Echo back the request's origin if it's allowed, else fall back to prod. */
function corsHeaders(origin: string | null) {
  const allow =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[ALLOWED_ORIGINS.length - 1];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

/** Strip tags/scripts/styles to plain text and cap length for the prompt. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
}

/** Gemini sometimes wraps JSON in ```json fences even with responseMimeType. */
function stripFences(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}

const FIELDS = [
  "company",
  "role",
  "location",
  "salary_min",
  "salary_max",
  "salary_currency",
  "company_size",
  "job_description",
] as const;

// Allowed company-size buckets. The model is asked to pick one of these;
// anything else is rejected to null.
const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10000+",
] as const;

// Allowed location values. The model maps the posting's location(s) onto these;
// anything that doesn't match is dropped.
const LOCATIONS = [
  "remote",
  "nyc",
  "sf",
  "seattle",
  "boston",
  "la",
  "chicago",
  "dc",
] as const;

/** Keep only known keys, coerce blanks to null, and apply field-specific rules. */
function normalize(obj: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of FIELDS) {
    const v = obj?.[k];
    out[k] = v === undefined || v === "" ? null : v;
  }

  // company_size must be exactly one of the known buckets.
  if (!COMPANY_SIZES.includes(out.company_size as (typeof COMPANY_SIZES)[number])) {
    out.company_size = null;
  }

  // location -> array of known values only. Accept a string or array from the
  // model; lowercase, dedupe, and drop anything not in LOCATIONS.
  const rawLoc = out.location;
  const locArr = Array.isArray(rawLoc)
    ? rawLoc
    : typeof rawLoc === "string"
      ? [rawLoc]
      : [];
  const allowed = new Set<string>(LOCATIONS);
  out.location = [
    ...new Set(
      locArr
        .map((x) => String(x).trim().toLowerCase())
        .filter((x) => allowed.has(x)),
    ),
  ];

  // If only one salary figure came back, mirror it so a single number fills
  // both min and max.
  const min = out.salary_min;
  const max = out.salary_max;
  if (typeof min === "number" && max == null) out.salary_max = min;
  if (typeof max === "number" && min == null) out.salary_min = max;

  return out;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not set" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  let url: string | undefined;
  let text: string | undefined;
  try {
    ({ url, text } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  // Resolve the content to parse.
  let content = (text ?? "").trim();
  if (url && !content) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)" },
        redirect: "follow",
      });
      content = htmlToText(await res.text());
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `Could not fetch URL: ${String(err)}` }),
        { status: 502, headers: jsonHeaders },
      );
    }
  }

  if (!content) {
    return new Response(
      JSON.stringify({ error: "No content: provide a url or text." }),
      { status: 400, headers: jsonHeaders },
    );
  }

  const prompt = `Extract job posting fields from the text below.
Return ONLY JSON with keys: company, role, location, salary_min, salary_max,
salary_currency, company_size, job_description.
Use null for anything not stated.

Rules:
- location is an ARRAY of any of these values that apply (empty array if none):
  "remote", "nyc", "sf", "seattle", "boston", "la", "chicago", "dc".
  Map cities onto them (e.g. New York/Brooklyn -> "nyc", San Francisco/Bay Area
  -> "sf", Washington DC -> "dc", Los Angeles -> "la"). Include "remote" if the
  role is remote. Use [] for locations not in this list.
- salary_min/max are integers (annual) or null. If a single salary figure is
  stated (not a range), set BOTH salary_min and salary_max to that number. If a
  range is stated, use the lower bound for salary_min and the upper for salary_max.
- salary_currency is a 3-letter code (e.g. "USD") or null.
- company_size MUST be exactly one of these strings, or null if unknown:
  "1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10000+".
  Pick the bucket containing the company's employee count.
- job_description = the full posting text, cleaned of navigation/boilerplate.

TEXT:
${content}`;

  let g: Response;
  try {
    g = await fetch(`${GEMINI_URL(MODEL)}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Gemini request failed: ${String(err)}` }),
      { status: 502, headers: jsonHeaders },
    );
  }

  if (!g.ok) {
    const detail = await g.text();
    return new Response(
      JSON.stringify({ error: `Gemini error ${g.status}`, detail }),
      { status: 502, headers: jsonHeaders },
    );
  }

  const data = await g.json();
  const jsonText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripFences(jsonText));
  } catch {
    return new Response(
      JSON.stringify({ error: "Model did not return valid JSON", raw: jsonText }),
      { status: 502, headers: jsonHeaders },
    );
  }

  return new Response(JSON.stringify(normalize(parsed)), {
    headers: jsonHeaders,
  });
});
