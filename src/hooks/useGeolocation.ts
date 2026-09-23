import { useCallback, useState } from "react";
import type { LatLng } from "../types/place";

export type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unavailable";

/**
 * Browser geolocation — only ever requested after explicit user interaction.
 */
export function useGeolocation() {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      setError("Geolocation is not supported by this browser.");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus("granted");
      },
      (geoError) => {
        setStatus(geoError.code === geoError.PERMISSION_DENIED ? "denied" : "unavailable");
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission was denied."
            : "Could not determine your location."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }, []);

  return { location, status, error, requestLocation };
}
