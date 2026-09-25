/**
 * GeoJSON / PostGIS coordinate helpers.
 *
 * The backend serializes location three ways depending on serializer:
 *   - `location`: GeoJSON Point with [lng, lat] order (PostGIS)
 *   - `latitude` / `longitude`: DecimalField values that DRF renders as
 *     STRINGS ("45.421500")
 * Every consumer must go through these helpers instead of touching raw
 * fields — that keeps GeoJSON ordering and string-decimal quirks in one place.
 */

import type { GeoJsonPoint, PlaceListEntry } from "../types";

/** Parse a DRF decimal (string | number | null) to a finite number or null. */
export function toCoord(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/** Extract [lng, lat] from a place for MapLibre (which expects lng-first). */
export function placeLngLat(place: PlaceListEntry): [number, number] | null {
  // Prefer the canonical PostGIS GeoJSON point when present.
  const geo: GeoJsonPoint | null | undefined = place.location;
  if (
    geo &&
    geo.type === "Point" &&
    Array.isArray(geo.coordinates) &&
    geo.coordinates.length >= 2
  ) {
    const [lng, lat] = geo.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lng, lat];
  }
  const lat = toCoord(place.latitude);
  const lng = toCoord(place.longitude);
  if (lat !== null && lng !== null) return [lng, lat];
  return null;
}

/** Haversine distance in metres (client-side fallback when the API did not
 * annotate distance_m — e.g. after the user pans the map). */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Human-friendly distance label. */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

/** Google Maps directions URL (a link-out — we never scrape or call the
 * Google API from the client; simple URI scheme is allowed by ToS). */
export function directionsUrl(lat: number, lng: number, name?: string): string {
  const dest = `${lat},${lng}`;
  const label = name ? `&query=${encodeURIComponent(name)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${label}`;
}
