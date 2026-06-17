import { useEffect, useRef, useState, type CSSProperties } from "react";

interface Option {
  value: string;
  label: string;
  color?: string;
}

interface Props {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

/** CSS custom property for chip color. */
const cv = (c?: string): CSSProperties =>
  c ? ({ "--c": c } as CSSProperties) : {};

function Chip({ option }: { option: Option }) {
  return (
    <span className={option.color ? "chip" : "chip chip-plain"} style={cv(option.color)}>
      {option.label}
    </span>
  );
}

/** Checkbox dropdown for picking several options. Closes on outside click. */
export default function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  const selected = options.filter((o) => value.includes(o.value));

  return (
    <div className="multiselect" ref={ref}>
      <button
        type="button"
        className="multiselect-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        {selected.length ? (
          <span className="ms-selected">
            {selected.map((o) => (
              <Chip key={o.value} option={o} />
            ))}
          </span>
        ) : (
          <span className="muted">{placeholder}</span>
        )}
        <span className="multiselect-caret">▾</span>
      </button>
      {open && (
        <div className="multiselect-menu">
          {options.map((o) => (
            <label key={o.value} className="multiselect-option">
              <input
                type="checkbox"
                checked={value.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
              <Chip option={o} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
