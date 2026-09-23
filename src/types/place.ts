export type PlaceType =
  | "restaurant"
  | "mosque"
  | "grocery"
  | "butcher"
  | "community-center"
  | "islamic-school";

export type HalalStatus = "fully-halal" | "halal-options" | "unknown";

/** Weekly opening hours. */
export interface OpeningHours {
  /** e.g. "10:00" */
  opens: string;
  /** e.g. "22:00" */
  closes: string;
  /** Days this range applies to; empty/undefined means every day. */
  days?: Weekday[];
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface MosqueInfo {
  /** Jumu'ah prayer times, e.g. ["12:30 PM", "1:30 PM"] */
  jumahTimes?: string[];
  womensPrayerArea?: boolean;
  parking?: boolean;
  accessible?: boolean;
  weekendSchool?: boolean;
  communityPrograms?: boolean;
  languages?: string[];
  /** Factual affiliation supplied by the dataset — never inferred. */
  tradition?: string;
}

export interface Place {
  id: string;
  name: string;
  type: PlaceType;
  city: string;
  province: string;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  description?: string;
  halalStatus?: HalalStatus;
  cuisine?: string[];
  tags?: string[];
  openingHours?: OpeningHours[];
  mosque?: MosqueInfo;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** A place enriched with distance from the user, when known. */
export interface PlaceWithDistance extends Place {
  /** Distance in kilometres from the user's location, or null if unknown. */
  distanceKm: number | null;
}

export type SortOption = "recommended" | "rating" | "reviews" | "distance";

export type CategoryFilter = PlaceType | "all";

export interface Filters {
  query: string;
  category: CategoryFilter;
  province: string | null;
  city: string | null;
  halalStatus: HalalStatus | null;
  cuisine: string | null;
  minRating: number | null;
  openNow: boolean;
  mosqueJumah: boolean;
  mosqueWomensArea: boolean;
  mosqueParking: boolean;
}
