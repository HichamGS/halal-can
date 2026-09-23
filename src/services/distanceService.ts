import type { LatLng, PlaceWithDistance, SortOption } from "../types/place";
import { distanceToPlaceKm, formatDistance } from "../utils/distance";

export interface PlaceDTO extends PlaceWithDistance {
  /** Pre-formatted display distance, e.g. "1.2 km" (null when unknown). */
  distanceLabel: string | null;
}

/** Enrich places with distances from `origin` (null → no distances). */
export function withDistances(places: PlaceWithDistance[], origin: LatLng | null): PlaceDTO[] {
  return places.map((place) => {
    const distanceKm = distanceToPlaceKm(place, origin);
    return { ...place, distanceKm, distanceLabel: formatDistance(distanceKm) };
  });
}

/**
 * "Recommended" blends rating and review popularity (Bayesian-style smoothing)
 * so a 4.8★ mosque with 10 reviews doesn't outrank a 4.6★ restaurant with 200.
 */
function recommendationScore(place: PlaceDTO): number {
  const rating = place.rating ?? 0;
  const reviews = place.reviewCount ?? 0;
  const priorWeight = 30; // Pseudo-count of baseline reviews.
  const priorMean = 4.2; // Dataset-wide average assumption.
  return ((reviews * rating + priorWeight * priorMean) / (reviews + priorWeight)) +
    Math.min(reviews, 500) / 10000;
}

export function sortPlaces(places: PlaceDTO[], option: SortOption): PlaceDTO[] {
  const sorted = [...places];
  switch (option) {
    case "rating":
      sorted.sort(
        (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
      );
      break;
    case "reviews":
      sorted.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
      break;
    case "distance":
      // Places without a known distance sink to the bottom.
      sorted.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      break;
    case "recommended":
      sorted.sort((a, b) => recommendationScore(b) - recommendationScore(a));
      break;
  }
  return sorted;
}

/** Google Maps directions URL — works without any API key. */
export function directionsUrl(place: PlaceDTO): string {
  const dest = `${place.latitude},${place.longitude}`;
  if (place.distanceKm !== null) {
    const params = new URLSearchParams({
      api: "1",
      source: "application",
      destinationquery: encodeURIComponent(`${place.name}|${dest}`),
      travelmode: "driving",
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}
