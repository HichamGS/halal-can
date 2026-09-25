/**
 * PlaceDetail — slide-over panel with full place info fetched from
 * GET /api/v1/places/{id}/, plus actions: directions, report, edit-suggest.
 */

import { useEffect, useState } from "react";
import {
  Clock,
  ExternalLink,
  Flag,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Pencil,
  X,
} from "lucide-react";
import { fetchPlace } from "../services/api";
import type { PlaceDetail as PlaceDetailType } from "../types";
import {
  directionsUrl,
  formatDistance,
  placeLngLat,
  toCoord,
} from "../utils/geo";
import { StatusBadge, VerificationBadge } from "./Badges";
import ReportDialog from "./ReportDialog";
import SuggestPlaceDialog from "./SuggestPlaceDialog";
import "./PlaceList.css";

interface Props {
  placeId: number;
  /** distance_m from the list query (if nearby search was used). */
  distanceMeters?: number | null;
  onClose: () => void;
}

export default function PlaceDetail({ placeId, distanceMeters, onClose }: Props) {
  const [place, setPlace] = useState<PlaceDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetchPlace(placeId, ac.signal)
      .then(setPlace)
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [placeId]);

  // Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const coords = place ? placeLngLat(place) : null;
  const distLabel = formatDistance(distanceMeters ?? null);

  return (
    <div className="place-detail-overlay" onClick={onClose}>
      <aside
        className="place-detail"
        role="dialog"
        aria-modal="true"
        aria-label="Place details"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="detail-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {loading && (
          <p style={{ display: "flex", gap: 8, alignItems: "center", padding: "24px 0" }}>
            <Loader2 size={16} className="spin" /> Loading…
          </p>
        )}
        {error && <p className="mc-alert error">{error}</p>}

        {place && !loading && (
          <>
            <h2>{place.name}</h2>
            <div className="place-badges">
              <VerificationBadge status={place.verification_status} />
              <StatusBadge status={place.status} />
              {distLabel && (
                <span className="mc-badge verified">
                  <Navigation size={12} /> {distLabel} away
                </span>
              )}
            </div>

            {place.description && (
              <div className="detail-section">
                <p>{place.description}</p>
              </div>
            )}

            <div className="detail-section">
              <h3>Contact & location</h3>
              <ul className="contact-list">
                <li>
                  <MapPin size={14} style={{ verticalAlign: -2 }} />{" "}
                  {[place.address, place.city, place.province, place.postal_code]
                    .filter(Boolean)
                    .join(", ") || "Address unavailable"}
                </li>
                {place.phone && (
                  <li>
                    <Phone size={14} style={{ verticalAlign: -2 }} />{" "}
                    <a href={`tel:${place.phone}`}>{place.phone}</a>
                  </li>
                )}
                {place.website && (
                  <li>
                    <Globe size={14} style={{ verticalAlign: -2 }} />{" "}
                    <a href={place.website} target="_blank" rel="noopener noreferrer">
                      {place.website.replace(/^https?:\/\//, "")}
                      <ExternalLink size={12} style={{ verticalAlign: -1, marginLeft: 3 }} />
                    </a>
                  </li>
                )}
                {place.email && (
                  <li>
                    <Mail size={14} style={{ verticalAlign: -2 }} />{" "}
                    <a href={`mailto:${place.email}`}>{place.email}</a>
                  </li>
                )}
              </ul>
            </div>

            {(place.categories.length > 0 || place.communities.length > 0) && (
              <div className="detail-section">
                <h3>Tags</h3>
                <div className="place-badges">
                  {place.categories.map((c) => (
                    <span key={c.slug} className="mc-badge category">{c.name}</span>
                  ))}
                  {place.communities.map((c) => (
                    <span key={c.slug} className="mc-badge community">{c.name}</span>
                  ))}
                </div>
              </div>
            )}

            {place.opening_hours.length > 0 && (
              <div className="detail-section">
                <h3>
                  <Clock size={12} style={{ verticalAlign: -2 }} /> Opening hours
                </h3>
                <table className="hours-table">
                  <tbody>
                    {place.opening_hours.map((h) => (
                      <tr key={h.day}>
                        <td>{h.day}</td>
                        <td>
                          {h.is_closed
                            ? "Closed"
                            : h.opens && h.closes
                              ? `${h.opens} – ${h.closes}`
                              : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {place.source_references.length > 0 && (
              <div className="detail-section">
                <h3>Data sources</h3>
                {place.source_references.map((s) => (
                  <p key={s.external_id} className="source-ref">
                    Ref: <code>{s.external_id}</code>
                    {s.source_url && (
                      <>
                        {" — "}
                        <a href={s.source_url} target="_blank" rel="noopener noreferrer">
                          provider page
                        </a>
                      </>
                    )}
                  </p>
                ))}
              </div>
            )}

            <div className="detail-actions">
              {coords && (
                <a
                  className="mc-btn"
                  href={directionsUrl(
                    toCoord(place.latitude) ?? coords[1],
                    toCoord(place.longitude) ?? coords[0],
                    place.name
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation size={15} /> Directions
                </a>
              )}
              <button className="mc-btn secondary" onClick={() => setShowSuggest(true)}>
                <Pencil size={14} /> Suggest an edit
              </button>
              <button className="mc-btn secondary" onClick={() => setShowReport(true)}>
                <Flag size={14} /> Report
              </button>
            </div>
          </>
        )}
      </aside>

      {showReport && place && (
        <ReportDialog placeId={place.id} placeName={place.name} onClose={() => setShowReport(false)} />
      )}
      {showSuggest && place && (
        <SuggestPlaceDialog
          onClose={() => setShowSuggest(false)}
          initialValues={{
            submission_type: "report_incorrect",
            place: place.id,
            suggested_name: place.name,
            suggested_phone: place.phone ?? undefined,
            suggested_website: place.website ?? undefined,
            suggested_address: place.address ?? undefined,
            suggested_city: place.city ?? undefined,
            suggested_province: place.province ?? undefined,
          }}
        />
      )}
    </div>
  );
}
