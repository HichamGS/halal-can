import { SORT_OPTIONS } from "../../utils/categories";
import type { SortOption } from "../../types/place";

interface SortSelectorProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  /** Distance sorting is only meaningful once the user's location is known. */
  distanceAvailable: boolean;
}

export function SortSelector({ value, onChange, distanceAvailable }: SortSelectorProps) {
  return (
    <label className="results-count" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      Sort
      <select
        className="sort-select"
        aria-label="Sort results"
        value={value}
        onChange={(e) => onChange(e.target.value as SortOption)}
      >
        {SORT_OPTIONS.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.value === "distance" && !distanceAvailable}
          >
            {option.value === "distance" && !distanceAvailable
              ? `${option.label} (enable location)`
              : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
