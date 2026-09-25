/**
 * Places query hook — the single bridge between UI filter state and the
 * backend's PostGIS-powered /places/ endpoint (search, taxonomies, radius).
 */

import { useMemo } from "react";
import { fetchPlaces } from "../services/api";
import type { Paginated, PlaceListEntry, PlaceQuery } from "../types";
import { useAsync, useDebouncedValue } from "./useApi";

export interface PlacesFilterState {
  search: string;
  community: string; // slug or ""
  category: string; // slug or ""
  province: string; // code or ""
  city: string; // name or ""
  verifiedOnly: boolean;
  /** Nearby/"near me" search — set together with userLocation. */
  lat?: number;
  lng?: number;
  radius?: number;
  page: number;
}

export const INITIAL_FILTERS: PlacesFilterState = {
  search: "",
  community: "",
  category: "",
  province: "",
  city: "",
  verifiedOnly: false,
  radius: undefined,
  page: 1,
};

export function placesQueryFromFilters(f: PlacesFilterState): PlaceQuery {
  const nearby = f.lat !== undefined && f.lng !== undefined;
  return {
    search: f.search.trim() || undefined,
    community: f.community || undefined,
    category: f.category || undefined,
    province: f.province || undefined,
    city: f.city || undefined,
    verified: f.verifiedOnly ? true : undefined,
    ...(nearby
      ? { lat: f.lat, lng: f.lng, radius: f.radius ?? 10000, ordering: "distance" }
      : {}),
    page: f.page,
  };
}

export function usePlaces(filters: PlacesFilterState): {
  data: Paginated<PlaceListEntry> | null;
  error: Error | null;
  loading: boolean;
  query: PlaceQuery;
} {
  const debouncedSearch = useDebouncedValue(filters.search);
  const effective = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch]
  );
  const query = useMemo(() => placesQueryFromFilters(effective), [effective]);

  const { data, error, loading } = useAsync<Paginated<PlaceListEntry>>(
    (signal) => fetchPlaces(query, signal),
    [JSON.stringify(query)]
  );
  return { data, error, loading, query };
}
