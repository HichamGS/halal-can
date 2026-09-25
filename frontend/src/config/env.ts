/**
 * Central, typed access to all client-safe environment variables.
 *
 * SECURITY RULE: this file must never read or forward provider API keys
 * (Google Places, etc.). All provider secrets live server-side in Django;
 * the browser only ever talks to our own /api/v1 endpoints.
 */

const raw = import.meta.env;

/* ------------------------------------------------------------------------ *
 * Offline fallback style
 *
 * A fully self-contained raster style pointing at OpenStreetMap's public
 * tile server. It exists ONLY as a last-resort development fallback when no
 * configured style can be loaded. Production deployments MUST set
 * VITE_MAP_STYLE_URL / MAP_STYLE_URL to a self-hosted or licensed style and
 * MUST NOT rely on the public OSM tile server for traffic.
 * ------------------------------------------------------------------------ */
import type { StyleSpecification } from "maplibre-gl";

const OFFLINE_FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  name: "MC offline fallback",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors (dev fallback only)",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#e8e6e3" } },
    { id: "osm-tiles", type: "raster", source: "osm" },
  ],
};

/* ------------------------------------------------------------------------ *
 * Candidate map styles, in priority order:
 *   1. Runtime config injected by the nginx container (/config.json)
 *   2. Build-time env var (VITE_MAP_STYLE_URL)
 *   3. Remote demo style (requires internet access)
 *   4. Bundled offline fallback style object (always works)
 * The first candidate that loads successfully wins.
 * ------------------------------------------------------------------------ */
async function fetchRuntimeStyleUrl(): Promise<string | null> {
  try {
    const res = await fetch("/config.json", { cache: "no-store" });
    if (!res.ok) return null;
    const cfg = (await res.json()) as Record<string, unknown>;
    const v = cfg?.MAP_STYLE_URL;
    return typeof v === "string" && v.trim() ? v : null;
  } catch {
    return null; // no runtime config (e.g. plain `vite dev`) — fine
  }
}

export async function resolveMapStyle(): Promise<string | typeof OFFLINE_FALLBACK_STYLE> {
  const runtime = await fetchRuntimeStyleUrl();
  if (runtime) return runtime;
  if (raw.VITE_MAP_STYLE_URL) return raw.VITE_MAP_STYLE_URL;
  return "https://demotiles.maplibre.org/style.json";
}

/** Configurable tile/style layer — swap providers without touching app code.
 * These values are synchronously-safe defaults; MaghrebMap awaits
 * resolveMapStyle() asynchronously so the runtime-configured style still
 * takes effect. */
export const MAP_CONFIG = {
  styleURL: raw.VITE_MAP_STYLE_URL ?? "https://demotiles.maplibre.org/style.json",
  fallbackStyle: OFFLINE_FALLBACK_STYLE,
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
