import type { HalalStatus, PlaceType } from "../types/place";

export interface CategoryMeta {
  value: PlaceType;
  label: string;
  /** Emoji used inside map marker pins (compact + universally rendered). */
  emoji: string;
}

/** Order here drives the order of category chips in the sidebar. */
export const CATEGORIES: CategoryMeta[] = [
  { value: "restaurant", label: "Restaurants", emoji: "🍽" },
  { value: "mosque", label: "Mosques", emoji: "🕌" },
  { value: "grocery", label: "Grocery", emoji: "🛒" },
  { value: "butcher", label: "Butchers", emoji: "🥩" },
  { value: "community-center", label: "Community Centers", emoji: "🏢" },
  { value: "islamic-school", label: "Islamic Schools", emoji: "📚" },
];

const BY_VALUE = new Map(CATEGORIES.map((c) => [c.value, c]));

export function categoryLabel(type: PlaceType): string {
  return BY_VALUE.get(type)?.label.replace(/s$/, "") ?? type;
}

export function categoryEmoji(type: PlaceType): string {
  return BY_VALUE.get(type)?.emoji ?? "📍";
}

export const HALAL_STATUS_LABELS: Record<HalalStatus, string> = {
  "fully-halal": "Fully Halal",
  "halal-options": "Halal Options",
  unknown: "Unknown",
};

/** Visual dot colour per halal status — only shown when data states it. */
export const HALAL_STATUS_DOT: Record<HalalStatus, string> = {
  "fully-halal": "var(--color-success)",
  "halal-options": "var(--color-warning)",
  unknown: "var(--color-muted)",
};

export const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "rating", label: "Highest rated" },
  { value: "reviews", label: "Most reviewed" },
  { value: "distance", label: "Nearest" },
] as const;

/** Demo map centre — Ottawa. */
export const DEFAULT_CENTER = { lat: 45.4215, lng: -75.6972 };
export const DEFAULT_ZOOM = 12;
export const SELECTED_ZOOM = 14.5;
