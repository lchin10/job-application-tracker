import { useEffect, useState } from "react";
import {
  ACTIONS,
  DEFAULT_BINDINGS,
  comboFromEvent,
  type Action,
  type Bindings,
} from "../lib/shortcuts";

interface Props {
  open: boolean;
  onClose: () => void;
  bindings: Bindings;
  onChange: (next: Bindings) => void;
}

export default function ShortcutsModal({ open, onClose, bindings, onChange }: Props) {
  const [capturing, setCapturing] = useState<Action | null>(null);

  useEffect(() => {
    if (!open) setCapturing(null);
  }, [open]);

  // Escape closes; while capturing, the next key combo becomes the binding.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!capturing) {
        if (e.key === "Escape") onClose();
        return;
      }
      e.preventDefault();
      if (e.key === "Escape") return setCapturing(null);
      const combo = comboFromEvent(e);
      if (!combo) return;
      onChange({ ...bindings, [capturing]: combo });
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, capturing, bindings, onChange]);

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>Keyboard shortcuts</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {(Object.keys(ACTIONS) as Action[]).map((a) => (
            <div key={a} className="shortcut-row">
              <span>{ACTIONS[a]}</span>
              <kbd>{capturing === a ? "Press keys… (Esc cancels)" : bindings[a]}</kbd>
              <button className="btn btn-ghost" onClick={() => setCapturing(a)}>
                Change
              </button>
            </div>
          ))}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => onChange(DEFAULT_BINDINGS)}>
              Reset defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
