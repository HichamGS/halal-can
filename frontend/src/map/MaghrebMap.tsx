/**
 * MaghrebMap — thin React wrapper around MapLibre GL.
 *
 * Design constraints (see spec §18):
 *  - The style/tile source is 100% configurable via VITE_MAP_STYLE_URL.
 *    Nothing in this component hard-codes a tile provider, and the public
 *    OpenStreetMap tile server is never referenced.
 *  - Markers are rendered from API data passed in as props; the map itself
 *    holds no business data.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import maplibregl, { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_CONFIG } from "../config/env";
import type { PlaceListEntry } from "../types";
import { placeLngLat } from "../utils/geo";

export interface MaghrebMapHandle {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  fitCanada: () => void;
  getUserPosition: () => Promise<{ lng: number; lat: number }>;
}

interface Props {
  places: PlaceListEntry[];
  selectedId: number | null;
  onSelectPlace: (place: PlaceListEntry) => void;
  /** Optional user-location marker drawn by the "near me" feature. */
  userLocation?: { lng: number; lat: number } | null;
  /** Radius circle (metres) around userLocation for nearby search UX. */
  radius?: number;
}

function makeMarkerElement(place: PlaceListEntry, selected: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = `mc-marker${selected ? " mc-marker-selected" : ""}`;
  el.title = place.name;
  return el;
}

const MaghrebMap = forwardRef<MaghrebMapHandle, Props>(function MaghrebMap(
  { places, selectedId, onSelectPlace, userLocation, radius },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const userMarkerRef = useRef<Marker | null>(null);
  const circleLayerState = useRef<{ source: string; added: boolean }>({
    source: "mc-radius",
    added: false,
  });
  const onSelectRef = useRef(onSelectPlace);
  onSelectRef.current = onSelectPlace;

  /* ---- init once ---- */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_CONFIG.styleURL,
      center: [MAP_CONFIG.center.lng, MAP_CONFIG.center.lat],
      zoom: MAP_CONFIG.zoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-left"
    );
    map.on("load", () => {
      // GeoJSON source for the optional radius circle (data-driven paint).
      map.addSource(circleLayerState.current.source, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "mc-radius-circle",
        type: "fill",
        source: circleLayerState.current.source,
        paint: {
          "fill-color": "#0e7c66",
          "fill-opacity": 0.08,
        },
      });
      map.addLayer({
        id: "mc-radius-outline",
        type: "line",
        source: circleLayerState.current.source,
        paint: {
          "line-color": "#0e7c66",
          "line-width": 1.5,
          "line-dasharray": [2, 2],
        },
      });
      circleLayerState.current.added = true;
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

  /* ---- render markers from API results ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const place of places) {
      const coords = placeLngLat(place);
      if (!coords) continue; // defensive: places without coordinates stay off-map
      const marker = new maplibregl.Marker({
        element: makeMarkerElement(place, place.id === selectedId),
        anchor: "bottom",
      })
        .setLngLat(coords)
        .addTo(map);
      marker.getElement().addEventListener("click", () => {
        onSelectRef.current(place);
      });
      markersRef.current.push(marker);
    }
  }, [places, selectedId]);

  /* ---- user location + radius circle ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    const src = map.getSource(
      circleLayerState.current.source
    ) as maplibregl.GeoJSONSource | undefined;

    if (!userLocation) {
      src?.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    const el = document.createElement("div");
    el.className = "mc-user-marker";
    el.title = "You are here";
    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);

    if (radius && circleLayerState.current.added && src) {
      src.setData(geoJsonCircle(userLocation.lng, userLocation.lat, radius));
    } else if (!radius && src) {
      src.setData({ type: "FeatureCollection", features: [] });
    }
  }, [userLocation, radius]);

  useImperativeHandle(ref, () => ({
    flyTo(lng, lat, zoom = 14) {
      mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 900 });
    },
    fitCanada() {
      mapRef.current?.fitBounds(
        [
          [-141, 40],
          [-52, 84],
        ],
        { duration: 800 }
      );
    },
    getUserPosition() {
      return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
          reject(new Error("Geolocation is not supported by this browser."));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
          (err) => reject(new Error(err.message || "Unable to get your location.")),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    },
  }));

  return <div ref={containerRef} className="mc-map" aria-label="Map of places" />;
});

/** Build a ~60-vertex polygon approximating a metre-radius circle. */
function geoJsonCircle(lng: number, lat: number, radiusMeters: number) {
  const points: [number, number][] = [];
  const earthRadius = 6378137;
  const latRad = (lat * Math.PI) / 180;
  const dLat = radiusMeters / earthRadius * (180 / Math.PI);
  const dLng = (radiusMeters / (earthRadius * Math.cos(latRad))) * (180 / Math.PI);
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * 2 * Math.PI;
    points.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  points.push(points[0]);
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: [points] },
        properties: {},
      },
    ],
  };
}

export default MaghrebMap;
