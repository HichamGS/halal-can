import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Header } from "./components/Header/Header";
import { CategoryFilters } from "./components/CategoryFilters/CategoryFilters";
import { FilterPanel } from "./components/FilterPanel/FilterPanel";
import { SortSelector } from "./components/SortSelector/SortSelector";
import { PlaceList } from "./components/PlaceList/PlaceList";
import { PlaceDetails } from "./components/PlaceDetails/PlaceDetails";
import { EmptyState } from "./components/EmptyState/EmptyState";
import { MapView } from "./components/Map/MapView";
import { usePlaces } from "./hooks/usePlaces";
import { useFilters } from "./hooks/useFilters";
import { useGeolocation } from "./hooks/useGeolocation";
import { matchesFilters, uniqueCities, uniqueCuisines, uniqueProvinces } from "./utils/filtering";
import { sortPlaces, withDistances } from "./services/distanceService";
import type { PlaceDTO } from "./services/distanceService";

export default function App() {
  const { places, status, error, reload } = usePlaces();
  const geo = useGeolocation();
  const {
    filters,
    sort,
    setSort,
    setQuery,
    setCategory,
    setProvince,
    setCity,
    setHalalStatus,
    setCuisine,
    setMinRating,
    setOpenNow,
    setMosqueFlag,
    resetFilters,
    showFoodFilters,
    showMosqueFilters,
    activeFilterCount,
  } = useFilters();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  const provinces = useMemo(() => uniqueProvinces(places), [places]);
  const cities = useMemo(() => uniqueCities(places, filters.province), [places, filters.province]);
  const cuisines = useMemo(() => uniqueCuisines(places), [places]);

  const results: PlaceDTO[] = useMemo(() => {
    const filtered = places.filter((p) => matchesFilters(p, filters));
    return sortPlaces(withDistances(filtered.map((p) => ({ ...p, distanceKm: null })), geo.location), sort);
  }, [places, filters, geo.location, sort]);

  const selectedPlace = useMemo(
    () => results.find((p) => p.id === selectedId) ?? null,
    [results, selectedId]
  );

  // Selecting from the list also asks the map to fly to the place.
  const selectFromList = useCallback((id: string) => {
    setSelectedId(id);
    setFocusToken((t) => t + 1);
  }, []);

  const locationLabel = useMemo(() => {
    if (filters.city && filters.province) return `${filters.city}, ${shortProv(filters.province)}`;
    if (filters.city) return filters.city;
    if (geo.location) return "Your location";
    return "Ottawa, ON";
  }, [filters.city, filters.province, geo.location]);

  return (
    <div className="app-shell">
      <Header
        query={filters.query}
        onQueryChange={setQuery}
        locationLabel={locationLabel}
        onUseMyLocation={geo.requestLocation}
        geoStatus={geo.status}
      />

      <div className="app-body">
        <aside className="sidebar" aria-label="Search and filters">
          <div className="sidebar-scroll">
            <CategoryFilters selected={filters.category} onSelect={setCategory} />
            <FilterPanel
              filters={filters}
              provinces={provinces}
              cities={cities}
              cuisines={cuisines}
              showFoodFilters={showFoodFilters}
              showMosqueFilters={showMosqueFilters}
              activeFilterCount={activeFilterCount}
              onProvinceChange={setProvince}
              onCityChange={setCity}
              onHalalStatusChange={setHalalStatus}
              onCuisineChange={setCuisine}
              onMinRatingChange={setMinRating}
              onOpenNowChange={setOpenNow}
              onMosqueFlagChange={setMosqueFlag}
              onReset={resetFilters}
            />
            <div className="results-bar">
              <span className="results-count" aria-live="polite">
                {status === "loading" ? "Loading…" : `${results.length} place${results.length === 1 ? "" : "s"}`}
              </span>
              <SortSelector
                value={sort}
                onChange={setSort}
                distanceAvailable={geo.location !== null}
              />
            </div>

            {status === "loading" && (
              <div className="skeleton-list" aria-hidden="true">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton" />
                ))}
              </div>
            )}

            {status === "error" && (
              <div className="state-panel" role="alert">
                <span className="state-icon">
                  <AlertTriangle size={32} />
                </span>
                <h3>Couldn&apos;t load places</h3>
                <p>{error}</p>
                <button type="button" className="btn btn-secondary" onClick={reload}>
                  <RotateCcw size={14} aria-hidden="true" /> Try again
                </button>
              </div>
            )}

            {status === "ready" && results.length === 0 && (
              <EmptyState
                actionLabel={activeFilterCount > 0 || filters.query ? "Clear filters" : undefined}
                onAction={
                  activeFilterCount > 0 || filters.query
                    ? () => {
                        resetFilters();
                        setSelectedId(null);
                      }
                    : undefined
                }
              />
            )}

            {status === "ready" && results.length > 0 && (
              <PlaceList places={results} selectedId={selectedId} onSelect={selectFromList} />
            )}
          </div>
        </aside>

        <main className="map-area">
          <MapView
            places={results}
            selectedId={selectedId}
            userLocation={geo.location}
            focusToken={focusToken}
            onSelectPlace={setSelectedId}
          />
          {selectedPlace && (
            <PlaceDetails place={selectedPlace} onClose={() => setSelectedId(null)} />
          )}
        </main>
      </div>
    </div>
  );
}

function shortProv(province: string): string {
  const map: Record<string, string> = {
    Ontario: "ON",
    Quebec: "QC",
    Alberta: "AB",
    "British Columbia": "BC",
  };
  return map[province] ?? province;
}
