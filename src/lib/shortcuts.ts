// Rebindable keyboard shortcuts. Bindings are combo strings like "ctrl+arrowup",
// kept per-browser in localStorage.

export const ACTIONS = {
  add: "Add application",
  bulk: "Bulk add applications",
  calendar: "Open calendar",
  top: "Go to top",
  bottom: "Go to bottom",
  search: "Focus search",
} as const;

export type Action = keyof typeof ACTIONS;
export type Bindings = Record<Action, string>;

export const DEFAULT_BINDINGS: Bindings = {
  add: "n",
  bulk: "m",
  calendar: "c",
  top: "ctrl+arrowup",
  bottom: "ctrl+arrowdown",
  search: "s",
};

const KEY = "shortcuts";

/** "ctrl+shift+k" style combo for a keydown, or null for a bare modifier press. */
export function comboFromEvent(e: KeyboardEvent): string | null {
  const key = e.key.toLowerCase();
  if (["control", "shift", "alt", "meta"].includes(key)) return null;
  return [e.ctrlKey && "ctrl", e.altKey && "alt", e.shiftKey && "shift", e.metaKey && "meta", key]
    .filter(Boolean)
    .join("+");
}

export function loadBindings(): Bindings {
  try {
    return { ...DEFAULT_BINDINGS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_BINDINGS;
  }
}

export function saveBindings(b: Bindings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    // storage blocked: binding still applies for this session
  }
}
