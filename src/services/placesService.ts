import type { Place } from "../types/place";
import placesJson from "../data/places.json";

/**
 * Data-access layer for places.
 *
 * The UI never imports `places.json` directly — it goes through this module,
 * which mimics an async REST client. Swapping the static JSON for a Laravel
 * API later only requires changing the bodies of these functions to `fetch()`
 * calls (e.g. `GET /api/places`, `GET /api/places/:id`).
 */

const LATENCY_MS = 250; // Simulated network latency so loading states behave realistically.

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getPlaces(): Promise<Place[]> {
  await delay(LATENCY_MS);
  return structuredClone(placesJson as Place[]);
}

export async function getPlaceById(id: string): Promise<Place | undefined> {
  const places = await getPlaces();
  return places.find((place) => place.id === id);
}

export async function getPlacesByCategory(category: Place["type"]): Promise<Place[]> {
  const places = await getPlaces();
  return places.filter((place) => place.type === category);
}
