/**
 * Single API service layer for the whole web app.
 *
 * IMPORTANT: this is the ONLY place in the frontend that knows endpoint URLs.
 * The React Native app will re-implement exactly this thin layer against the
 * same Django /api/v1 contract — no business data or logic lives in the UI.
 */

import { http } from "./http";
import type {
  Category,
  CityOption,
  Community,
  Paginated,
  PlaceDetail,
  PlaceListEntry,
  PlaceQuery,
  ProvinceOption,
  ReportPayload,
  SubmissionCreatePayload,
  SubmissionResult,
} from "../types";

/* ---------------- Places ---------------- */

export function fetchPlaces(
  query: PlaceQuery = {},
  signal?: AbortSignal
): Promise<Paginated<PlaceListEntry>> {
  return http.get<Paginated<PlaceListEntry>>("/places/", { ...query }, signal);
}

export function fetchPlace(id: number, signal?: AbortSignal): Promise<PlaceDetail> {
  return http.get<PlaceDetail>(`/places/${id}/`, undefined, signal);
}

/* ---------------- Taxonomies (data-driven — never hard-coded) ---------- */

export function fetchCommunities(signal?: AbortSignal): Promise<Community[]> {
  return http.get<Community[]>("/communities/", undefined, signal);
}

export function fetchCategories(signal?: AbortSignal): Promise<Category[]> {
  return http.get<Category[]>("/categories/", undefined, signal);
}

export function fetchProvinces(signal?: AbortSignal): Promise<ProvinceOption[]> {
  return http.get<ProvinceOption[]>("/provinces/", undefined, signal);
}

export function fetchCities(
  province?: string,
  signal?: AbortSignal
): Promise<CityOption[]> {
  return http.get<CityOption[]>("/cities/", province ? { province } : undefined, signal);
}

/* ---------------- Community contributions (moderated) ---------------- */

/** Suggest a new place / correction — lands in the admin moderation queue. */
export function createSubmission(
  payload: SubmissionCreatePayload
): Promise<SubmissionResult> {
  return http.post<SubmissionResult>("/submissions/", payload);
}

/** Report a specific place (closed / incorrect info / wrong address). */
export function reportPlace(
  placeId: number,
  payload: ReportPayload
): Promise<SubmissionResult> {
  return http.post<SubmissionResult>(`/places/${placeId}/report`, payload);
}
