/**
 * Generic, typed HTTP client for the Maghreb Connect Django REST API.
 *
 * Design rules:
 *  - The browser ONLY ever calls our own /api/v1 endpoints (no provider keys
 *    client-side, no direct Google/OSM calls from the frontend).
 *  - DRF errors (400 validation dicts, 429 throttle) are normalized into
 *    ApiError so UI code can render field-level messages.
 */

import { API_BASE_URL } from "../config/env";

export class ApiError extends Error {
  readonly status: number;
  /** Field-level validation errors, e.g. { suggested_name: ["Required..."] } */
  readonly details: Record<string, string[]> | null;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = normalizeDetails(details);
  }
}

function normalizeDetails(raw: unknown): Record<string, string[]> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      out[key] = value.map(String);
    } else if (typeof value === "string") {
      out[key] = [value];
    } else if (value && typeof value === "object") {
      // nested DRF error (e.g. non-field errors under "detail")
      out[key] = [JSON.stringify(value)];
    }
  }
  return Object.keys(out).length ? out : null;
}

function buildUrl(path: string, params?: Record<string, unknown>): string {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!params) return url;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "boolean") {
      qs.set(key, value ? "true" : "false");
    } else {
      qs.set(key, String(value));
    }
  }
  const q = qs.toString();
  return q ? `${url}?${q}` : url;
}

async function request<T>(
  url: string,
  init?: RequestInit,
  signal?: AbortSignal
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      signal,
      ...init,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "Network error — is the API running?");
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON response body; fall through to status handling */
    }
  }

  if (!res.ok) {
    const message =
      res.status === 429
        ? "Too many requests — please slow down."
        : (data as { detail?: string })?.detail ??
          `Request failed (${res.status} ${res.statusText})`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export const http = {
  get: <T>(path: string, params?: Record<string, unknown>, signal?: AbortSignal) =>
    request<T>(buildUrl(path, params), { method: "GET" }, signal),

  post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>(buildUrl(path), { method: "POST", body: JSON.stringify(body) }, signal),
};
