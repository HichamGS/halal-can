import { useCallback, useMemo, useState } from "react";
import type { CategoryFilter, Filters, PlaceType, SortOption } from "../types/place";

export const EMPTY_FILTERS: Filters = {
  query: "",
  category: "all",
  province: null,
  city: null,
  halalStatus: null,
  cuisine: null,
  minRating: null,
  openNow: false,
  mosqueJumah: false,
  mosqueWomensArea: false,
  mosqueParking: false,
};

/** All filter + sort state for the discovery UI, with granular setters. */
export function useFilters() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortOption>("recommended");

  const setQuery = useCallback(
    (query: string) => setFilters((f) => ({ ...f, query })),
    []
  );
  const setCategory = useCallback(
    (category: CategoryFilter) => setFilters((f) => ({ ...f, category })),
    []
  );
  const setProvince = useCallback(
    (province: string | null) =>
      // Changing province invalidates any city chosen under the old province.
      setFilters((f) => ({ ...f, province, city: null })),
    []
  );
  const setCity = useCallback((city: string | null) => setFilters((f) => ({ ...f, city })), []);
  const setHalalStatus = useCallback(
    (halalStatus: Filters["halalStatus"]) => setFilters((f) => ({ ...f, halalStatus })),
    []
  );
  const setCuisine = useCallback(
    (cuisine: string | null) => setFilters((f) => ({ ...f, cuisine })),
    []
  );
  const setMinRating = useCallback(
    (minRating: number | null) => setFilters((f) => ({ ...f, minRating })),
    []
  );
  const setOpenNow = useCallback(
    (openNow: boolean) => setFilters((f) => ({ ...f, openNow })),
    []
  );
  const setMosqueFlag = useCallback(
    (flag: "mosqueJumah" | "mosqueWomensArea" | "mosqueParking", value: boolean) =>
      setFilters((f) => ({ ...f, [flag]: value })),
    []
  );
  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  /** True when a restaurant-specific filter is relevant to show. */
  const showFoodFilters = filters.category === "all" || isFoodType(filters.category);
  /** True when mosque-specific filters are relevant to show. */
  const showMosqueFilters = filters.category === "all" || filters.category === "mosque";

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.province) count++;
    if (filters.city) count++;
    if (filters.halalStatus) count++;
    if (filters.cuisine) count++;
    if (filters.minRating !== null) count++;
    if (filters.openNow) count++;
    if (filters.mosqueJumah) count++;
    if (filters.mosqueWomensArea) count++;
    if (filters.mosqueParking) count++;
    return count;
  }, [filters]);

  return {
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
  };
}

function isFoodType(category: PlaceType): boolean {
  return category === "restaurant" || category === "grocery" || category === "butcher";
}
