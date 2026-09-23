import { useEffect, useMemo, useRef } from "react";
import maplibregl, { Marker, Popup, StyleSpecification } from "maplibre-gl";
import Supercluster from "supercluster";
import type { LatLng, Place } from "../../types/place";
import { categoryEmoji, DEFAULT_CENTER, DEFAULT_ZOOM, SELECTED_ZOOM } from "../../utils/categories";

/**
 * Free, OpenStreetMap-compatible raster style. To change the map look later,
 * swap `MAP_STYLE` for another free style (e.g. MapLibre demotiles) or a
 * hosted vector style URL — no API key is required for OSM raster tiles.
 */
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster",
      source: "osm",
    },
  ],
};

const CLUSTER_MAX_ZOOM = 14; // Beyond this zoom every place gets its own pin.
const CLUSTER_RADIUS_PX = 55;
const MARKER_ANCHOR_OFFSET: [number, number] = [0, 16]; // pin tip sits on the coordinate

interface PointFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface ClusterPointFeature {
  type: "Feature";
  properties: { id: string };
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface MapViewProps {
  places: Place[];
  selectedId: string | null;
  userLocation: LatLng | null;
  /** Bumped when the sidebar asks the map to fly to the selection. */
  focusToken: number;
  onSelectPlace: (id: string) => void;
}

export function MapView({
  places,
  selectedId,
  userLocation,
  focusToken,
  onSelectPlace,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const popupRef = useRef<Popup | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelectPlace);
  onSelectRef.current = onSelectPlace;

  const index = useMemo(() => {
    const points: ClusterPointFeature[] = places.map((p) => ({
      type: "Feature",
      properties: { id: p.id },
      geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
    }));
    const idx = new Supercluster<{ id: string }, Record<string, never>>({
      maxZoom: CLUSTER_MAX_ZOOM,
      radius: CLUSTER_RADIUS_PX,
    });
    return idx.load(points);
  }, [places]);

  const placesById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  // Create the map exactly once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
      zoom: DEFAULT_ZOOM,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      popupRef.current = null;
      userMarkerRef.current = null;
    };
  }, []);

  // Re-cluster on move/zoom and whenever results or selection change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const render = () => {
      const zoom = Math.round(map.getZoom());
      const bounds = map.getBounds();
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];
      const clusters = index.getClusters(bbox, zoom) as unknown as PointFeature[];
      syncMarkers({
        map,
        clusters,
        index,
        placesById,
        selectedId,
        markersRef,
        popupRef,
        onSelect: onSelectRef.current,
      });
    };

    if (map.isStyleLoaded()) render();
    else map.once("load", render);

    map.on("moveend", render);
    return () => {
      map.off("moveend", render);
    };
  }, [index, placesById, selectedId]);

  // Pan to the selected place when requested from the list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId || focusToken === 0) return;
    const place = placesById.get(selectedId);
    if (!place) return;
    map.easeTo({
      center: [place.longitude, place.latitude],
      zoom: Math.max(map.getZoom(), SELECTED_ZOOM),
      duration: 500,
    });
  }, [focusToken, selectedId, placesById]);

  // User-location dot.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "user-dot";
      el.setAttribute("aria-label", "Your location");
      userMarkerRef.current = new Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }
    map.easeTo({ center: [userLocation.lng, userLocation.lat], zoom: 13, duration: 700 });
  }, [userLocation]);

  return <div ref={containerRef} className="map-container" aria-label="Map of places" />;
}

interface SyncParams {
  map: maplibregl.Map;
  clusters: PointFeature[];
  index: Supercluster<{ id: string }, Record<string, never>>;
  placesById: Map<string, Place>;
  selectedId: string | null;
  markersRef: React.MutableRefObject<Map<string, Marker>>;
  popupRef: React.MutableRefObject<Popup | null>;
  onSelect: (id: string) => void;
}

/** Diff the DOM marker set against the current cluster summary. */
function syncMarkers({
  map,
  clusters,
  index,
  placesById,
  selectedId,
  markersRef,
  popupRef,
  onSelect,
}: SyncParams): void {
  const existing = markersRef.current;
  const wanted = new Set<string>();

  for (const feature of clusters) {
    const [lng, lat] = feature.geometry.coordinates;

    if (feature.properties.cluster) {
      const clusterId = feature.properties.cluster_id as number;
      const key = `cluster-${clusterId}`;
      wanted.add(key);
      let marker = existing.get(key);
      if (!marker) {
        marker = createClusterMarker(map, index, clusterId, onSelect);
        existing.set(key, marker);
      }
      marker.setLngLat([lng, lat]).addTo(map);
      const count = index.getLeaves(clusterId, Infinity).length;
      const el = marker.getElement();
      if (el.textContent !== String(count)) el.textContent = String(count);
    } else {
      const id = String(feature.properties.id ?? "");
      const place = placesById.get(id);
      if (!place) continue;
      wanted.add(id);
      let marker = existing.get(id);
      if (!marker) {
        marker = createPlaceMarker(place, onSelect);
        existing.set(id, marker);
      }
      marker.setLngLat([lng, lat]).addTo(map);
      marker.getElement().classList.toggle("selected", id === selectedId);
    }
  }

  for (const [key, marker] of existing) {
    if (!wanted.has(key)) {
      marker.remove();
      existing.delete(key);
    }
  }

  // Popup for the selected place.
  popupRef.current?.remove();
  popupRef.current = null;
  if (selectedId) {
    const marker = existing.get(selectedId);
    const place = placesById.get(selectedId);
    if (marker && place) {
      popupRef.current = new Popup({ offset: 24, closeButton: false })
        .setLngLat(marker.getLngLat())
        .setHTML(popupHtml(place))
        .addTo(map);
    }
  }
}

function createClusterMarker(
  map: maplibregl.Map,
  index: Supercluster<{ id: string }, Record<string, never>>,
  clusterId: number,
  onSelect: (id: string) => void
): Marker {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "cluster-badge";
  el.setAttribute("aria-label", "Cluster of places — click to expand");
  const marker = new Marker({ element: el, anchor: "center" });
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    const leaves = index.getLeaves(clusterId, Infinity);
    if (leaves.length === 1) {
      onSelect(leaves[0].properties.id);
      return;
    }
    if (map) {
      const expansionZoom = Math.min(index.getClusterExpansionZoom(clusterId), 18);
      map.easeTo({ center: marker.getLngLat(), zoom: expansionZoom, duration: 400 });
    }
  });
  return marker;
}

function createPlaceMarker(place: Place, onSelect: (id: string) => void): Marker {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "marker-pin";
  el.setAttribute("aria-label", place.name);
  el.title = place.name;
  const inner = document.createElement("span");
  inner.textContent = categoryEmoji(place.type);
  el.appendChild(inner);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(place.id);
  });
  return new Marker({ element: el, anchor: "bottom", offset: MARKER_ANCHOR_OFFSET });
}

function popupHtml(place: Place): string {
  const rating =
    typeof place.rating === "number" ? ` · <strong>${place.rating.toFixed(1)}</strong>` : "";
  const address = place.address ?? `${place.city}, ${place.province}`;
  return `${escapeHtml(place.name)}${rating}<br/>${escapeHtml(address)}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
