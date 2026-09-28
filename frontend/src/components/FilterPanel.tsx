/**
 * FilterPanel — community / category / province / city / search / nearby.
 *
 * Community and category options are fetched from the API (data-driven):
 * adding a new community (e.g. "Somali") or category requires NO frontend
 * code change — it simply appears in these dropdowns.
 */

import { MapPin, RotateCcw, Search } from "lucide-react";
import { fetchCategories, fetchCities, fetchCommunities, fetchProvinces } from "../services/api";
import { RADIUS_OPTIONS } from "../config/env";
import { useAsync } from "../hooks/useApi";
import type { PlacesFilterState } from "../hooks/usePlaces";
import "./FilterPanel.css";

interface Props {
  filters: PlacesFilterState;
  onChange: (patch: Partial<PlacesFilterState>) => void;
  onReset: () => void;
  onNearMe: () => void;
  nearMeLoading?: boolean;
  nearMeActive: boolean;
}

export default function FilterPanel({
  filters,
  onChange,
  onReset,
  onNearMe,
  nearMeLoading,
  nearMeActive,
}: Props) {
  const communities = useAsync((s) => fetchCommunities(s), []);
  const categories = useAsync((s) => fetchCategories(s), []);
  const provinces = useAsync((s) => fetchProvinces(s), []);
  const cities = useAsync(
    (s) => fetchCities(filters.province || undefined, s),
    [filters.province]
  );

  const hasActiveFilters =
    !!filters.search ||
    !!filters.community ||
    !!filters.category ||
    !!filters.province ||
    !!filters.city ||
    filters.verifiedOnly ||
    nearMeActive;

  return (
    <section className="filter-panel" aria-label="Search filters">
      <div className="search-row">
        <div className="search-input">
          <Search size={16} aria-hidden />
          <input
            type="search"
            placeholder='Try "Moroccan bakery", "halal grocery", "Ottawa"…'
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
            aria-label="Search places"
          />
        </div>
        <button
          type="button"
          className={`mc-btn secondary near-btn${nearMeActive ? " active" : ""}`}
          onClick={onNearMe}
          disabled={nearMeLoading}
          title="Search places near my location"
        >
          <MapPin size={15} />
          {nearMeLoading ? "Locating…" : nearMeActive ? "Near me ✓" : "Near me"}
        </button>
      </div>

      {nearMeActive && (
        <div className="radius-row">
          <label htmlFor="radius">Within</label>
          <select
            id="radius"
            value={filters.radius ?? 10000}
            onChange={(e) =>
              onChange({ radius: Number(e.target.value), page: 1 })
            }
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="filter-grid">
        <label>
          <span>Community</span>
          <select
            value={filters.community}
            onChange={(e) => onChange({ community: e.target.value, page: 1 })}
            aria-label="Filter by community"
          >
            <option value="">All communities</option>
            {(communities.data ?? []).map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Category</span>
          <select
            value={filters.category}
            onChange={(e) => onChange({ category: e.target.value, page: 1 })}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Province</span>
          <select
            value={filters.province}
            onChange={(e) =>
              onChange({ province: e.target.value, city: "", page: 1 })
            }
            aria-label="Filter by province"
          >
            <option value="">All Canada</option>
            {(provinces.data ?? []).map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>City</span>
          <select
            value={filters.city}
            onChange={(e) => onChange({ city: e.target.value, page: 1 })}
            aria-label="Filter by city"
            disabled={!filters.province && (cities.data ?? []).length === 0}
          >
            <option value="">All cities</option>
            {(cities.data ?? []).map((c) => (
              <option key={`${c.province}-${c.name}`} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filter-footer">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={filters.verifiedOnly}
            onChange={(e) => onChange({ verifiedOnly: e.target.checked, page: 1 })}
          />
          Verified only
        </label>
        {hasActiveFilters && (
          <button type="button" className="reset-btn" onClick={onReset}>
            <RotateCcw size={13} /> Clear filters
          </button>
        )}
      </div>
    </section>
  );
}
