/**
 * PlaceList — API result cards with distance, badges and pagination.
 */

import { ChevronLeft, ChevronRight, MapPin, Navigation } from "lucide-react";
import { PAGE_SIZE } from "../config/env";
import type { Paginated, PlaceListEntry } from "../types";
import { formatDistance } from "../utils/geo";
import { StatusBadge, VerificationBadge } from "./Badges";
import "./PlaceList.css";

interface Props {
  data: Paginated<PlaceListEntry> | null;
  loading: boolean;
  error: Error | null;
  selectedId: number | null;
  currentPage: number;
  onSelect: (place: PlaceListEntry) => void;
  onPageChange: (page: number) => void;
}

export default function PlaceList({
  data,
  loading,
  error,
  selectedId,
  currentPage,
  onSelect,
  onPageChange,
}: Props) {
  if (error) {
    return (
      <div className="place-list-state">
        <p className="mc-alert error">{error.message}</p>
        <p className="mc-form-note">
          Make sure the Django API is running (dev proxy maps /api/v1 → :8000).
        </p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="place-list-state">
        <span className="mc-spinner" /> Loading places…
      </div>
    );
  }

  const results = data?.results ?? [];

  if (!results.length) {
    return (
      <div className="place-list-state">
        <MapPin size={28} aria-hidden />
        <p>No places match your filters yet.</p>
        <p className="mc-form-note">
          Know one? Use “Suggest a place” to add it — submissions are reviewed
          by our moderators.
        </p>
      </div>
    );
  }

  const pageCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(pageCount / PAGE_SIZE));

  return (
    <div className="place-list">
      <header className="place-list-header">
        <strong>{data?.count ?? 0}</strong> place{data?.count === 1 ? "" : "s"} found
        {loading && <span className="mc-spinner" style={{ marginLeft: 8 }} />}
      </header>

      <ul>
        {results.map((place) => {
          const dist = formatDistance(place.distance_m);
          return (
            <li key={place.id}>
              <button
                type="button"
                className={`place-card${selectedId === place.id ? " selected" : ""}`}
                onClick={() => onSelect(place)}
              >
                <div className="place-card-top">
                  <span className="place-name">{place.name}</span>
                  {dist && (
                    <span className="place-distance">
                      <Navigation size={12} /> {dist}
                    </span>
                  )}
                </div>
                <div className="place-meta">
                  <MapPin size={12} aria-hidden />
                  {[place.city, place.province].filter(Boolean).join(", ") || "Canada"}
                </div>
                <div className="place-badges">
                  <VerificationBadge status={place.verification_status} />
                  <StatusBadge status={place.status} />
                  {place.categories.slice(0, 2).map((c) => (
                    <span key={c.slug} className="mc-badge category">{c.name}</span>
                  ))}
                  {place.communities.slice(0, 2).map((c) => (
                    <span key={c.slug} className="mc-badge community">{c.name}</span>
                  ))}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <nav className="pagination" aria-label="Pagination">
        <button
          type="button"
          className="mc-btn secondary small"
          disabled={!data?.previous || loading}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          className="mc-btn secondary small"
          disabled={!data?.next || loading}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next <ChevronRight size={14} />
        </button>
      </nav>
    </div>
  );
}
