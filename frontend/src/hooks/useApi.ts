/**
 * Minimal data-fetching hooks shared by web (and conceptually by mobile).
 *
 * Rules:
 *  - Hooks never contain business logic — they only wrap the API service
 *    layer with loading/error state and request cancellation.
 *  - All data comes from the Django /api/v1 endpoints; nothing is baked in.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../services/http";

interface AsyncState<T> {
  data: T | null;
  error: ApiError | Error | null;
  loading: boolean;
}

/** Fetch once (or whenever `deps` change), with automatic abort on unmount. */
export function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[]
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const ac = new AbortController();
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current(ac.signal)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error: unknown) => {
        if (!alive || (error as Error)?.name === "AbortError") return;
        setState({ data: null, error: error as ApiError, loading: false });
      });
    return () => {
      alive = false;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

/** Debounce any value (used for the search box so we don't hammer the API). */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
