/**
 * Central, typed access to all client-safe environment variables.
 *
 * SECURITY RULE: this file must never read or forward provider API keys
 * (Google Places, etc.). All provider secrets live server-side in Django;
 * the browser only ever talks to our own /api/v1 endpoints.
 */

const raw = import.meta.env;

/** Configurable tile/style layer — swap providers without touching app code.
 * Default is the MapLibre demo style (dev only). Production MUST point
 * VITE_MAP_STYLE_URL at a self-hosted or licensed style — never the public
 * OpenStreetMap tile server. */
export const MAP_CONFIG = {
  styleURL:
    raw.VITE_MAP_STYLE_URL ?? "https://demotiles.maplibre.org/style.json",
  center: {
    lng: parseFloat(raw.VITE_MAP_CENTER_LNG ?? "-96.0"),
    lat: parseFloat(raw.VITE_MAP_CENTER_LAT ?? "58.0"),
  },
  zoom: parseFloat(raw.VITE_MAP_ZOOM ?? "3.5"),
  minZoom: 2.5,
  maxZoom: 18,
  attribution: "Maghreb Connect | Tiles: configure VITE_MAP_STYLE_URL",
} as const;

/** Base URL of the versioned Django REST API. In dev the Vite proxy maps
 * /api/v1 -> http://localhost:8000/api/v1 so no CORS setup is needed. */
export const API_BASE_URL = (raw.VITE_API_BASE_URL ?? "/api/v1").replace(
  /\/+$/,
  ""
);

/** Radius options offered in the "near me" UI, in metres. */
export const RADIUS_OPTIONS = [
  { value: 2000, label: "2 km" },
  { value: 5000, label: "5 km" },
  { value: 10000, label: "10 km" },
  { value: 25000, label: "25 km" },
  { value: 50000, label: "50 km" },
] as const;

export const PAGE_SIZE = 25;
