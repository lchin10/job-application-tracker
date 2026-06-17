import MultiSelect from "./MultiSelect";
import {
  LOCATIONS,
  LOCATION_LABELS,
  LOCATION_COLORS,
  COMPANY_SIZES,
  STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  OA_COLORS,
  EXTRA_INFO,
  EXTRA_INFO_COLORS,
} from "../lib/constants";

// Sentinel for "no value" so null/empty fields are filterable.
export const NONE = "__none__";

export interface Filters {
  location: string[];
  company_size: string[];
  status: string[];
  oa_status: string[];
  extra_info: string[];
}

export const EMPTY_FILTERS: Filters = {
  location: [],
  company_size: [],
  status: [],
  oa_status: [],
  extra_info: [],
};

const noneOpt = { value: NONE, label: "(none)" };

const LOCATION_OPTS = [
  ...LOCATIONS.map((v) => ({
    value: v,
    label: LOCATION_LABELS[v],
    color: LOCATION_COLORS[v],
  })),
  noneOpt,
];
const SIZE_OPTS = [
  ...COMPANY_SIZES.map((v) => ({ value: v, label: v })),
  noneOpt,
];
const STATUS_OPTS = [
  ...STATUSES.map((v) => ({
    value: v,
    label: STATUS_LABELS[v],
    color: STATUS_COLORS[v],
  })),
  { value: NONE, label: "(empty)" },
];
const OA_OPTS = [
  { value: "none", label: "none" },
  { value: "pending", label: "pending", color: OA_COLORS.pending },
  { value: "submitted", label: "submitted", color: OA_COLORS.submitted },
  { value: "dropped", label: "dropped", color: OA_COLORS.dropped },
];
const EXTRA_OPTS = [
  ...EXTRA_INFO.map((v) => ({ value: v, label: v, color: EXTRA_INFO_COLORS[v] })),
  noneOpt,
];

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
}

export default function FilterBar({ filters, onChange }: Props) {
  const set = (key: keyof Filters, value: string[]) =>
    onChange({ ...filters, [key]: value });

  const active =
    filters.location.length +
      filters.company_size.length +
      filters.status.length +
      filters.oa_status.length +
      filters.extra_info.length >
    0;

  return (
    <div className="filter-bar">
      <div className="filter-item">
        <span className="filter-label">Location</span>
        <MultiSelect
          options={LOCATION_OPTS}
          value={filters.location}
          onChange={(v) => set("location", v)}
          placeholder="All"
        />
      </div>
      <div className="filter-item">
        <span className="filter-label">Company size</span>
        <MultiSelect
          options={SIZE_OPTS}
          value={filters.company_size}
          onChange={(v) => set("company_size", v)}
          placeholder="All"
        />
      </div>
      <div className="filter-item">
        <span className="filter-label">Status</span>
        <MultiSelect
          options={STATUS_OPTS}
          value={filters.status}
          onChange={(v) => set("status", v)}
          placeholder="All"
        />
      </div>
      <div className="filter-item">
        <span className="filter-label">OA / HireVue</span>
        <MultiSelect
          options={OA_OPTS}
          value={filters.oa_status}
          onChange={(v) => set("oa_status", v)}
          placeholder="All"
        />
      </div>
      <div className="filter-item">
        <span className="filter-label">Extra info</span>
        <MultiSelect
          options={EXTRA_OPTS}
          value={filters.extra_info}
          onChange={(v) => set("extra_info", v)}
          placeholder="All"
        />
      </div>
      {active && (
        <button className="btn btn-ghost filter-clear" onClick={() => onChange(EMPTY_FILTERS)}>
          Clear filters
        </button>
      )}
    </div>
  );
}
