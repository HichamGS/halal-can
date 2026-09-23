import { useEffect, useRef } from "react";
import {
  Car,
  Clock,
  Globe,
  GraduationCap,
  Languages,
  MapPin,
  Phone,
  Star,
  Users,
  Accessibility,
  X,
} from "lucide-react";
import type { PlaceDTO } from "../../services/distanceService";
import { directionsUrl } from "../../services/distanceService";
import {
  categoryEmoji,
  categoryLabel,
  HALAL_STATUS_DOT,
  HALAL_STATUS_LABELS,
} from "../../utils/categories";

interface PlaceDetailsProps {
  place: PlaceDTO;
  onClose: () => void;
}

export function PlaceDetails({ place, onClose }: PlaceDetailsProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the panel when it opens so keyboard users land inside it.
  useEffect(() => {
    panelRef.current?.focus();
  }, [place.id]);

  return (
    <aside
      ref={panelRef}
      className="details-panel"
      role="dialog"
      aria-label={`${place.name} details`}
      tabIndex={-1}
    >
      <div className="details-header">
        <div className="details-title-wrap">
          <span className="details-category">
            <span aria-hidden="true">{categoryEmoji(place.type)}</span>
            {categoryLabel(place.type)}
          </span>
          <h2 className="details-name">{place.name}</h2>
        </div>
        <button type="button" className="details-close" aria-label="Close details" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="details-body">
        {(typeof place.rating === "number" || place.distanceLabel) && (
          <div className="rating-line">
            {typeof place.rating === "number" && (
              <>
                <span className="stars">
                  <Star size={15} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                  {place.rating.toFixed(1)}
                </span>
                {typeof place.reviewCount === "number" && (
                  <span className="reviews">{place.reviewCount} reviews</span>
                )}
              </>
            )}
            {place.distanceLabel && (
              <span className="badge badge-neutral">
                <MapPin size={12} aria-hidden="true" /> {place.distanceLabel} away
              </span>
            )}
          </div>
        )}

        {place.halalStatus && (
          <span
            className="badge badge-halal"
            style={{ alignSelf: "flex-start" }}
            aria-label={`Halal status: ${HALAL_STATUS_LABELS[place.halalStatus]}`}
          >
            <span
              className="halal-dot"
              style={{ background: HALAL_STATUS_DOT[place.halalStatus] }}
              aria-hidden="true"
            />
            {HALAL_STATUS_LABELS[place.halalStatus]}
          </span>
        )}

        {place.description && <p style={{ margin: 0 }}>{place.description}</p>}

        {place.cuisine && place.cuisine.length > 0 && (
          <div>
            <h3 className="section-title">Cuisine</h3>
            <div className="tag-row">
              {place.cuisine.map((c) => (
                <span key={c} className="badge badge-neutral">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {place.mosque && <MosqueSection place={place} />}

        {place.openingHours && place.openingHours.length > 0 && (
          <div>
            <h3 className="section-title">
              <Clock size={12} style={{ verticalAlign: -2, marginRight: 4 }} aria-hidden="true" />
              Opening hours
            </h3>
            <table className="hours-table">
              <tbody>
                {place.openingHours.map((range, i) => (
                  <tr key={i}>
                    <td>{formatDays(range.days)}</td>
                    <td>
                      {range.opens} – {range.closes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {place.address && (
          <div className="detail-row">
            <span className="icon" aria-hidden="true">
              <MapPin size={15} />
            </span>
            <span>{place.address}</span>
          </div>
        )}

        {place.phone && (
          <div className="detail-row">
            <span className="icon" aria-hidden="true">
              <Phone size={15} />
            </span>
            <a href={`tel:${place.phone.replace(/[^+\d]/g, "")}`}>{place.phone}</a>
          </div>
        )}

        {place.website && (
          <div className="detail-row">
            <span className="icon" aria-hidden="true">
              <Globe size={15} />
            </span>
            <a href={place.website} target="_blank" rel="noopener noreferrer">
              Website
            </a>
          </div>
        )}

        {place.tags && place.tags.length > 0 && (
          <div>
            <h3 className="section-title">Tags</h3>
            <div className="tag-row">
              {place.tags.map((tag) => (
                <span key={tag} className="badge badge-neutral">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="details-footer">
        <a
          className="btn btn-primary"
          href={directionsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Car size={15} aria-hidden="true" /> Directions
        </a>
        {place.phone && (
          <a className="btn btn-secondary" href={`tel:${place.phone.replace(/[^+\d]/g, "")}`}>
            <Phone size={15} aria-hidden="true" /> Call
          </a>
        )}
        {place.website && (
          <a
            className="btn btn-secondary"
            href={place.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Globe size={15} aria-hidden="true" /> Website
          </a>
        )}
      </div>
    </aside>
  );
}

function MosqueSection({ place }: { place: PlaceDTO }) {
  const mosque = place.mosque!;
  const facilities: string[] = [];
  if (mosque.womensPrayerArea) facilities.push("Women's prayer area");
  if (mosque.parking) facilities.push("Parking");
  if (mosque.accessible) facilities.push("Wheelchair accessible");
  if (mosque.weekendSchool) facilities.push("Weekend school");
  if (mosque.communityPrograms) facilities.push("Community programs");

  return (
    <>
      {mosque.jumahTimes && mosque.jumahTimes.length > 0 && (
        <div>
          <h3 className="section-title">Jumu&apos;ah</h3>
          <ul className="facility-list">
            {mosque.jumahTimes.map((time) => (
              <li key={time}>
                <Clock size={14} aria-hidden="true" />
                {time}
              </li>
            ))}
          </ul>
        </div>
      )}
      {facilities.length > 0 && (
        <div>
          <h3 className="section-title">Facilities</h3>
          <ul className="facility-list">
            {facilities.map((f) => (
              <li key={f}>
                {f === "Wheelchair accessible" ? (
                  <Accessibility size={14} aria-hidden="true" />
                ) : f === "Women's prayer area" ? (
                  <Users size={14} aria-hidden="true" />
                ) : f === "Weekend school" ? (
                  <GraduationCap size={14} aria-hidden="true" />
                ) : (
                  <MapPin size={14} aria-hidden="true" />
                )}
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
      {mosque.languages && mosque.languages.length > 0 && (
        <div className="detail-row">
          <span className="icon" aria-hidden="true">
            <Languages size={15} />
          </span>
          <span>Languages: {mosque.languages.join(", ")}</span>
        </div>
      )}
      {mosque.tradition && (
        <div className="detail-row">
          <span className="icon" aria-hidden="true">
            <Users size={15} />
          </span>
          <span>Tradition / affiliation: {mosque.tradition} (per dataset)</span>
        </div>
      )}
    </>
  );
}

const DAY_NAMES: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function formatDays(days?: string[]): string {
  if (!days || days.length === 0 || days.length === 7) return "Every day";
  return days.map((d) => DAY_NAMES[d] ?? d).join(", ");
}
