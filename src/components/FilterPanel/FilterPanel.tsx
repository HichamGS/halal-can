import type { Filters, HalalStatus } from "../../types/place";
import { HALAL_STATUS_LABELS } from "../../utils/categories";

interface FilterPanelProps {
  filters: Filters;
  provinces: string[];
  cities: string[];
  cuisines: string[];
  showFoodFilters: boolean;
  showMosqueFilters: boolean;
  activeFilterCount: number;
  onProvinceChange: (province: string | null) => void;
  onCityChange: (city: string | null) => void;
  onHalalStatusChange: (status: HalalStatus | null) => void;
  onCuisineChange: (cuisine: string | null) => void;
  onMinRatingChange: (rating: number | null) => void;
  onOpenNowChange: (openNow: boolean) => void;
  onMosqueFlagChange: (
    flag: "mosqueJumah" | "mosqueWomensArea" | "mosqueParking",
    value: boolean
  ) => void;
  onReset: () => void;
}

const RATING_CHOICES = [4.5, 4.0, 3.5] as const;

export function FilterPanel({
  filters,
  provinces,
  cities,
  cuisines,
  showFoodFilters,
  showMosqueFilters,
  activeFilterCount,
  onProvinceChange,
  onCityChange,
  onHalalStatusChange,
  onCuisineChange,
  onMinRatingChange,
  onOpenNowChange,
  onMosqueFlagChange,
  onReset,
}: FilterPanelProps) {
  return (
    <section className="side-section" aria-label="Filters">
      <h2>
        Filters
        {activeFilterCount > 0 && (
          <>
            {" "}
            <span className="badge badge-halal">{activeFilterCount} active</span>
          </>
        )}
      </h2>

      <div className="field-row">
        <div className="field">
          <label htmlFor="province-select">Province</label>
          <select
            id="province-select"
            value={filters.province ?? ""}
            onChange={(e) => onProvinceChange(e.target.value || null)}
          >
            <option value="">All provinces</option>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="city-select">City</label>
          <select
            id="city-select"
            value={filters.city ?? ""}
            onChange={(e) => onCityChange(e.target.value || null)}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showFoodFilters && (
        <div className="field-row" style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor="halal-select">Halal status</label>
            <select
              id="halal-select"
              value={filters.halalStatus ?? ""}
              onChange={(e) =>
                onHalalStatusChange((e.target.value || null) as HalalStatus | null)
              }
            >
              <option value="">Any</option>
              {(Object.keys(HALAL_STATUS_LABELS) as HalalStatus[]).map((status) => (
                <option key={status} value={status}>
                  {HALAL_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cuisine-select">Cuisine</label>
            <select
              id="cuisine-select"
              value={filters.cuisine ?? ""}
              onChange={(e) => onCuisineChange(e.target.value || null)}
            >
              <option value="">Any cuisine</option>
              {cuisines.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {showMosqueFilters && (
        <div className="check-row" style={{ marginTop: 10 }}>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.mosqueJumah}
              onChange={(e) => onMosqueFlagChange("mosqueJumah", e.target.checked)}
            />
            Has Jumu&apos;ah
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.mosqueWomensArea}
              onChange={(e) => onMosqueFlagChange("mosqueWomensArea", e.target.checked)}
            />
            Women&apos;s prayer area
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.mosqueParking}
              onChange={(e) => onMosqueFlagChange("mosqueParking", e.target.checked)}
            />
            Parking
          </label>
        </div>
      )}

      <div className="check-row" style={{ marginTop: 10 }}>
        <label className="check">
          <input
            type="checkbox"
            checked={filters.openNow}
            onChange={(e) => onOpenNowChange(e.target.checked)}
          />
          Open now
        </label>
        <label className="check">
          <span>Min rating</span>
          <select
            aria-label="Minimum rating"
            value={filters.minRating ?? ""}
            onChange={(e) =>
              onMinRatingChange(e.target.value ? Number(e.target.value) : null)
            }
            style={{ padding: "3px 6px", border: "1px solid var(--color-border-strong)", borderRadius: "var(--radius-sm)" }}
          >
            <option value="">Any</option>
            {RATING_CHOICES.map((r) => (
              <option key={r} value={r}>
                {r.toFixed(1)}★ &amp; up
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeFilterCount > 0 && (
        <button type="button" className="btn btn-ghost" style={{ marginTop: 10 }} onClick={onReset}>
          Clear all filters
        </button>
      )}
    </section>
  );
}
