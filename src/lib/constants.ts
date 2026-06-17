// Fixed company-size buckets, shared by the Add modal, the detail panel, and
// (in prompt form) the parse-job edge function.
export const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10000+",
] as const;

export type CompanySize = (typeof COMPANY_SIZES)[number];

// Fixed location options for the multi-select. Stored lowercase; displayed via
// LOCATION_LABELS. Shared with the parse-job edge function (in prompt form).
export const LOCATIONS = [
  "remote",
  "nyc",
  "sf",
  "seattle",
  "boston",
  "la",
  "chicago",
  "dc",
] as const;

export type Location = (typeof LOCATIONS)[number];

export const LOCATION_LABELS: Record<Location, string> = {
  remote: "Remote",
  nyc: "NYC",
  sf: "SF",
  seattle: "Seattle",
  boston: "Boston",
  la: "LA",
  chicago: "Chicago",
  dc: "DC",
};

// Dull, low-saturation colors — readable on the dark surface, easy on the eye.
export const LOCATION_COLORS: Record<string, string> = {
  remote: "#7fa888", // dull green
  nyc: "#7e9bc0", // dull blue
  sf: "#c2906a", // dull orange
  seattle: "#74aeae", // dull teal
  boston: "#c58a92", // dull rose
  la: "#bfae74", // dull gold
  chicago: "#a98fc0", // dull purple
  dc: "#98a1b0", // dull slate
};

/** Label for a stored location value; falls back to the raw value if unknown. */
export function locationLabel(value: string): string {
  return LOCATION_LABELS[value as Location] ?? value;
}

// Application status. Defaults to empty (null). Separate from oa_status, which
// tracks the OA/HireVue stage.
export const STATUSES = [
  "rejected",
  "ghosted",
  "pending",
  "interviewing",
  "offer",
  "dropped",
  "oa",
] as const;

export type AppStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<AppStatus, string> = {
  rejected: "Rejected",
  ghosted: "Ghosted",
  pending: "Pending",
  interviewing: "Interviewing",
  offer: "Offer",
  dropped: "Dropped",
  oa: "OA",
};

export const STATUS_COLORS: Record<string, string> = {
  rejected: "#c58a92", // dull rose
  ghosted: "#9a8f86", // dull taupe
  pending: "#bfae74", // dull gold
  interviewing: "#7e9bc0", // dull blue
  offer: "#7fa888", // dull green
  dropped: "#98a1b0", // dull slate
  oa: "#a98fc0", // dull purple
};

// OA / HireVue stage colors. "none" stays muted (no color).
export const OA_COLORS: Record<string, string> = {
  pending: "#bfae74", // dull gold
  submitted: "#7fa888", // dull green
  dropped: "#c58a92", // dull rose
};

// Application materials prepared. Multi-select; stored in the single text
// `extra_info` column as a comma-joined string of these exact labels.
export const EXTRA_INFO = [
  "Cover letter",
  "Why us",
  "Project/Technical",
  "About me",
  "Follow-up email",
  "Other",
] as const;

export const EXTRA_INFO_COLORS: Record<string, string> = {
  "Cover letter": "#c2906a", // dull orange
  "Why us": "#7e9bc0", // dull blue
  "Project/Technical": "#7fa888", // dull green
  "About me": "#a98fc0", // dull purple
  "Follow-up email": "#bfae74", // dull gold
  Other: "#98a1b0", // dull slate
};

/** Split the stored extra_info string into option values. */
export function splitExtraInfo(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Join selected extra_info options back into the stored string. */
export function joinExtraInfo(values: string[]): string | null {
  return values.length ? values.join(", ") : null;
}
