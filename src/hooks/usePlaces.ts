import { useCallback, useEffect, useState } from "react";
import type { Place } from "../types/place";
import { getPlaces } from "../services/placesService";

export type DataStatus = "loading" | "ready" | "error";

/**
 * Loads places through the data-access layer. Async by design so swapping the
 * static JSON for a REST API later requires no changes in consuming components.
 */
export function usePlaces() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<DataStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    getPlaces()
      .then((data) => {
        if (cancelled) return;
        setPlaces(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load places.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => reload(), [reload]);

  return { places, status, error, reload };
}
