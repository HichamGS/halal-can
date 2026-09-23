import type { LatLng, Place } from "../types/place";

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two coordinates, in kilometres. */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Distance from `origin` to a place, or null when origin is unknown. */
export function distanceToPlaceKm(
  place: Pick<Place, "latitude" | "longitude">,
  origin: LatLng | null
): number | null {
  if (!origin) return null;
  return haversineDistanceKm(origin, { lat: place.latitude, lng: place.longitude });
}

/** Formats a km value as e.g. "0.8 km" or "12.4 km". */
export function formatDistance(km: number | null): string | null {
  if (km === null || Number.isNaN(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
