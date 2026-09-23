import type { Filters, OpeningHours, Place, Weekday } from "../types/place";

const WEEKDAY_ORDER: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** True when the place's opening hours cover the current local time. */
export function isOpenNow(place: Place, now: Date = new Date()): boolean {
  if (!place.openingHours || place.openingHours.length === 0) return false;
  const today = WEEKDAY_ORDER[now.getDay()];
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return place.openingHours.some((range: OpeningHours) => {
    const appliesToday = !range.days || range.days.length === 0 || range.days.includes(today);
    if (!appliesToday) return false;
    const opens = toMinutes(range.opens);
    let closes = toMinutes(range.closes);
    // Handle ranges that roll past midnight (e.g. 20:00 – 02:00).
    if (closes <= opens) closes += 24 * 60;
    return minutesNow >= opens && minutesNow < closes;
  });
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Lower-cased haystack of every searchable field on a place. */
function searchHaystack(place: Place): string {
  return [
    place.name,
    place.city,
    place.province,
    place.address ?? "",
    place.type.replace("-", " "),
    place.description ?? "",
    (place.cuisine ?? []).join(" "),
    (place.tags ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

/** Applies all active filters; empty filter values are treated as "no constraint". */
export function matchesFilters(place: Place, filters: Filters, now: Date = new Date()): boolean {
  if (filters.category !== "all" && place.type !== filters.category) return false;
  if (filters.province && place.province !== filters.province) return false;
  if (filters.city && place.city !== filters.city) return false;

  if (filters.query.trim()) {
    const terms = filters.query.trim().toLowerCase().split(/\s+/);
    const haystack = searchHaystack(place);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }

  if (filters.halalStatus && place.halalStatus !== filters.halalStatus) return false;
  if (filters.cuisine && !(place.cuisine ?? []).includes(filters.cuisine)) return false;
  if (filters.minRating !== null && (place.rating ?? 0) < filters.minRating) return false;
  if (filters.openNow && !isOpenNow(place, now)) return false;

  if (filters.mosqueJumah && !(place.mosque?.jumahTimes?.length)) return false;
  if (filters.mosqueWomensArea && !place.mosque?.womensPrayerArea) return false;
  if (filters.mosqueParking && !place.mosque?.parking) return false;

  return true;
}

/** Unique, alphabetically sorted provinces present in the dataset. */
export function uniqueProvinces(places: Place[]): string[] {
  return [...new Set(places.map((p) => p.province))].sort((a, b) => a.localeCompare(b));
}

/** Cities for a province (or all cities when none selected), derived from data. */
export function uniqueCities(places: Place[], province: string | null): string[] {
  const scoped = province ? places.filter((p) => p.province === province) : places;
  return [...new Set(scoped.map((p) => p.city))].sort((a, b) => a.localeCompare(b));
}

/** All cuisines present in the dataset, for the cuisine filter dropdown. */
export function uniqueCuisines(places: Place[]): string[] {
  const cuisines = new Set<string>();
  for (const place of places) for (const c of place.cuisine ?? []) cuisines.add(c);
  return [...cuisines].sort((a, b) => a.localeCompare(b));
}
