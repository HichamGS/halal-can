/**
 * TypeScript mirror of the Django /api/v1 contract
 * (apps/places/serializers.py, apps/submissions/serializers.py).
 * Keep in sync with the backend — the API is the single source of truth.
 */

/* ---------------- GeoJSON (PostGIS location field) ---------------- */

export interface GeoJsonPoint {
  type: "Point";
  /** [longitude, latitude] — note GeoJSON coordinate order! */
  coordinates: [number, number];
}

/* ---------------- Taxonomies ---------------- */

export interface Community {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  parent: number | null;
  order: number;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  parent: number | null;
  order: number;
}

export interface ProvinceOption {
  code: string;
  name: string;
}

export interface CityOption {
  name: string;
  province: string;
}

/* ---------------- Places ---------------- */

export type PlaceStatus = "active" | "temporarily_closed" | "closed" | "pending";
export type VerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "reported"
  | "rejected";

export interface OpeningHours {
  day: string;
  opens: string | null;
  closes: string | null;
  is_closed: boolean;
}

/** External identity only — provider raw data is deliberately not exposed. */
export interface SourceReference {
  external_id: string;
  source_url: string | null;
  last_checked_at: string | null;
}

/** Fields shared by list + detail serializers. */
export interface PlaceListEntry {
  id: number;
  name: string;
  city: string;
  province: string;
  /** DecimalField from DRF arrives as string — normalize via toNumber(). */
  latitude: string | number | null;
  longitude: string | number | null;
  /** Optional GeoJSON Point (PostGIS). The current list serializer exposes
   * latitude/longitude only; placeLngLat() prefers `location` when present
   * and falls back to the decimal fields. */
  location?: GeoJsonPoint | null;
  status: PlaceStatus;
  verification_status: VerificationStatus;
  communities: Community[];
  categories: Category[];
  phone: string | null;
  website: string | null;
  address: string | null;
  /** Present only when the query included lat/lng (PostGIS Distance()). */
  distance_m: number | null;
}

export interface PlaceDetail extends PlaceListEntry {
  description: string | null;
  postal_code: string | null;
  email: string | null;
  opening_hours: OpeningHours[];
  source_references: SourceReference[];
  created_at: string;
  updated_at: string;
  last_verified_at: string | null;
  last_checked_at: string | null;
}

/* ---------------- Pagination (DRF PageNumberPagination) ---------------- */

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/* ---------------- Query params ---------------- */

export interface PlaceQuery {
  search?: string;
  community?: string; // slug
  category?: string; // slug
  province?: string;
  city?: string;
  status?: PlaceStatus;
  verified?: boolean;
  /** Nearby search: PostGIS centre + radius in metres. */
  lat?: number;
  lng?: number;
  radius?: number;
  /** Bounding box: min_lon,min_lat,max_lon,max_lat */
  bbox?: string;
  page?: number;
  ordering?: string; // e.g. "distance", "name", "-created_at"
}

/* ---------------- Submissions & reports ---------------- */

export type SubmissionType =
  | "suggest_place"
  | "report_closed"
  | "report_incorrect"
  | "address_correction"
  | "category_suggestion"
  | "community_suggestion";

export interface SubmissionCreatePayload {
  submission_type: SubmissionType;
  place?: number;
  suggested_name?: string;
  suggested_phone?: string;
  suggested_website?: string;
  suggested_address?: string;
  suggested_city?: string;
  suggested_province?: string;
  suggested_latitude?: number;
  suggested_longitude?: number;
  categories?: string[]; // slugs
  communities?: string[]; // slugs
  message?: string;
  submitter_email?: string;
  submitter_name?: string;
}

export interface SubmissionResult {
  id: number;
  submission_type: SubmissionType;
  status: string;
  created_at: string;
}

export type ReportType = "closed" | "incorrect_info" | "address" | "other";

export interface ReportPayload {
  report_type: ReportType;
  message: string;
}
