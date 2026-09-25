/**
 * App — Maghreb Connect discovery page.
 *
 * Composition only: all data flows through the API service layer and hooks.
 * There is NO business data in this file (spec §14).
 */

import { useCallback, useRef, useState } from "react";
import { Compass, PlusCircle } from "lucide-react";
import FilterPanel from "./components/FilterPanel";
import PlaceDetail from "./components/PlaceDetail";
import PlaceList from "./components/PlaceList";
import SuggestPlaceDialog from "./components/SuggestPlaceDialog";
import MaghrebMap, { type MaghrebMapHandle } from "./map/MaghrebMap";
import { INITIAL_FILTERS, usePlaces, type PlacesFilterState } from "./hooks/usePlaces";
import type { PlaceListEntry } from "./types";
import { toCoord } from "./utils/geo";

export default function App() {
  const [filters, setFilters] = useState<PlacesFilterState>(INITIAL_FILTERS);
  const [selected, setSelected] = useState<PlaceListEntry | null>(null);
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [nearMeLoading, setNearMeLoading] = useState(false);
  const [nearMeError, setNearMeError] = useState<string | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);
  const mapRef = useRef<MaghrebMapHandle>(null);

  const { data, error, loading } = usePlaces(filters);
  const places = data?.results ?? [];

  const updateFilters = useCallback((patch: Partial<PlacesFilterState>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setUserLocation(null);
    setNearMeError(null);
    mapRef.current?.fitCanada();
  }, []);

  const selectPlace = useCallback((place: PlaceListEntry) => {
    setSelected(place);
  }, []);

  const handleNearMe = useCallback(async () => {
    if (filters.lat !== undefined && filters.lng !== undefined) {
      // toggle off
      updateFilters({ lat: undefined, lng: undefined, radius: undefined, page: 1 });
      setUserLocation(null);
      return;
    }
    setNearMeLoading(true);
    setNearMeError(null);
    try {
      const pos = await mapRef.current!.getUserPosition();
      setUserLocation(pos);
      updateFilters({ lat: pos.lat, lng: pos.lng, radius: filters.radius ?? 10000, page: 1 });
      mapRef.current?.flyTo(pos.lng, pos.lat, 12);
    } catch (e) {
      setNearMeError((e as Error).message);
    } finally {
      setNearMeLoading(false);
    }
  }, [filters.lat, filters.lng, filters.radius, updateFilters]);

  return (
    <div className="mc-app">
      <header className="mc-header">
        <div className="logo">
          <Compass size={22} aria-hidden />
          Maghreb Connect
        </div>
        <span className="tagline">
          Discover community businesses, services & associations across Canada
        </span>
        <div className="spacer" />
        <button className="mc-btn ghost" onClick={() => setShowSuggest(true)}>
          <PlusCircle size={16} /> Suggest a place
        </button>
      </header>

      <main className="mc-main">
        <aside className="mc-sidebar">
          <FilterPanel
            filters={filters}
            onChange={updateFilters}
            onReset={resetFilters}
            onNearMe={handleNearMe}
            nearMeLoading={nearMeLoading}
            nearMeActive={filters.lat !== undefined}
          />
          {nearMeError && (
            <p className="mc-alert error" style={{ margin: 14 }}>
              {nearMeError}
            </p>
          )}
          <PlaceList
            data={data}
            loading={loading}
            error={error}
            selectedId={selected?.id ?? null}
            currentPage={filters.page}
            onSelect={(p) => {
              selectPlace(p);
              const lat = toCoord(p.latitude);
              const lng = toCoord(p.longitude);
              if (lat !== null && lng !== null) mapRef.current?.flyTo(lng, lat, 15);
            }}
            onPageChange={(page) => updateFilters({ page })}
          />
        </aside>

        <section className="mc-map-wrap">
          <MaghrebMap
            ref={mapRef}
            places={places}
            selectedId={selected?.id ?? null}
            onSelectPlace={selectPlace}
            userLocation={userLocation}
            radius={filters.lat !== undefined ? filters.radius : undefined}
          />
          {selected && (
            <PlaceDetail
              placeId={selected.id}
              distanceMeters={selected.distance_m}
              onClose={() => setSelected(null)}
            />
          )}
        </section>
      </main>

      {showSuggest && (
        <SuggestPlaceDialog
          onClose={() => setShowSuggest(false)}
          defaultLocation={
            userLocation ??
            (filters.lat !== undefined && filters.lng !== undefined
              ? { lng: filters.lng, lat: filters.lat }
              : null)
          }
        />
      )}
    </div>
  );
}
